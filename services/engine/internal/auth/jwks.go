// Package auth verifies Supabase-issued JWTs against the project's JWKS.
//
// JWKS endpoint:  $SUPABASE_URL/auth/v1/.well-known/jwks.json
// Cache:          24h, refreshed lazily on kid miss.
//
// For Phase 0 dev, Supabase local issues HS256 tokens by default. We accept
// either RS256 (via JWKS) or HS256 (via env-provided shared secret) so the
// dev loop works without flipping the auth server into asymmetric mode.
package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Verifier validates JWTs and returns the user_id (sub) claim.
type Verifier struct {
	jwksURL    string
	hsSecret   []byte
	httpClient *http.Client

	mu       sync.RWMutex
	keys     map[string]*rsa.PublicKey
	fetchedAt time.Time
	ttl       time.Duration
}

// NewVerifier returns a verifier configured for the given Supabase project.
// If hsSecret is non-empty, HS256 tokens with that secret are also accepted
// (Supabase local default).
func NewVerifier(jwksURL string, hsSecret string) *Verifier {
	return &Verifier{
		jwksURL:    jwksURL,
		hsSecret:   []byte(hsSecret),
		httpClient: &http.Client{Timeout: 5 * time.Second},
		keys:       make(map[string]*rsa.PublicKey),
		ttl:        24 * time.Hour,
	}
}

type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
	Alg string `json:"alg"`
}

type jwksDoc struct {
	Keys []jwk `json:"keys"`
}

func (v *Verifier) refreshJWKS(ctx context.Context) error {
	if v.jwksURL == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return fmt.Errorf("jwks request: %w", err)
	}
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("jwks fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks http %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("jwks read: %w", err)
	}
	var doc jwksDoc
	if err := json.Unmarshal(body, &doc); err != nil {
		return fmt.Errorf("jwks decode: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kty != "RSA" {
			continue
		}
		pk, err := parseRSAJWK(k)
		if err != nil {
			continue
		}
		keys[k.Kid] = pk
	}
	v.mu.Lock()
	v.keys = keys
	v.fetchedAt = time.Now()
	v.mu.Unlock()
	return nil
}

func parseRSAJWK(k jwk) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, fmt.Errorf("decode n: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, fmt.Errorf("decode e: %w", err)
	}
	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes).Int64()
	return &rsa.PublicKey{N: n, E: int(e)}, nil
}

// Verify parses + verifies the token and returns the `sub` claim.
func (v *Verifier) Verify(ctx context.Context, tokenStr string) (userID string, err error) {
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		switch t.Method.Alg() {
		case "HS256":
			if len(v.hsSecret) == 0 {
				return nil, errors.New("hs256 token but no shared secret configured")
			}
			return v.hsSecret, nil
		case "RS256":
			kid, _ := t.Header["kid"].(string)
			v.mu.RLock()
			key, ok := v.keys[kid]
			stale := time.Since(v.fetchedAt) > v.ttl
			v.mu.RUnlock()
			if !ok || stale {
				if err := v.refreshJWKS(ctx); err != nil {
					return nil, fmt.Errorf("refresh jwks: %w", err)
				}
				v.mu.RLock()
				key = v.keys[kid]
				v.mu.RUnlock()
			}
			if key == nil {
				return nil, fmt.Errorf("unknown kid %q", kid)
			}
			return key, nil
		default:
			return nil, fmt.Errorf("unsupported alg %s", t.Method.Alg())
		}
	})
	if err != nil {
		return "", fmt.Errorf("parse jwt: %w", err)
	}
	if !tok.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("unexpected claims type")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing sub claim")
	}
	return sub, nil
}
