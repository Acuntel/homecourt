// Package lmsr implements the LS-LMSR (Liquidity-Sensitive Logarithmic Market
// Scoring Rule) house market maker, per Othman/Pennock/Sandholm.
//
// We follow the standard formulation used by HOMECOURT BUILD.md §10b:
//
//	C(q) = b(q) · ln( Σ exp(qᵢ / b(q)) )
//	b(q) = max( bSeed, α · Σ qᵢ )
//
// where:
//   - α = 0.05 (5% vig; round-trip cost ≈ 1.25% near p=0.5)
//   - q is the outstanding shares vector (one entry per outcome bucket)
//   - bSeed is the floor liquidity parameter ($500 per market in HOMECOURT)
//
// Instantaneous price of outcome i:
//
//	pᵢ(q) = exp(qᵢ / b(q)) / Σ exp(qⱼ / b(q))
//
// Cost of buying dq shares of outcome i: C(q + dq·eᵢ) - C(q).
//
// Bounded loss for a 5-outcome market is b · ln(N) ≈ 0.6094 · b. At
// b=$500 that ≈ $304.71; with the α-growth term it asymptotes higher as q
// grows, capped operationally by our $200K position cap (see bot.go).
//
// All arithmetic uses float64. Money math at the engine boundary stays in
// int64 cents — these functions return floats which the bot rounds to cents
// before posting orders.
package lmsr

import (
	"errors"
	"fmt"
	"math"
)

// Quote is one side of a synthetic order book level.
type Quote struct {
	PriceCents int32
	Qty        int64
}

// MarketQuote is the full set of quotes for one market across all 5
// outcomes. Bids[outcome] and Asks[outcome] are the per-outcome ladders.
type MarketQuote struct {
	Bids [5][]Quote
	Asks [5][]Quote
}

// State holds the LS-LMSR parameters for one market.
//
//   - Alpha is the liquidity-sensitivity constant (5%).
//   - BSeed is the lower bound on the liquidity parameter (≈$500 worth of
//     "depth" in cents-equivalent shares).
//   - Q is the outstanding-shares vector across outcomes. Initial Q is
//     derived from the Zestimate prior via SeedFromPrices.
type State struct {
	Alpha float64
	BSeed float64
	Q     []float64
}

// New returns a fresh LS-LMSR state with N outcomes seeded to zero. zero-q
// gives a uniform 1/N price across all buckets.
func New(bSeed float64, n int) *State {
	if n <= 0 {
		n = 5
	}
	if bSeed <= 0 {
		bSeed = 500.0
	}
	return &State{Alpha: 0.05, BSeed: bSeed, Q: make([]float64, n)}
}

// liquidity returns b(q) = max(BSeed, Alpha * Σq).
//
// Note: classical LS-LMSR uses b(q) = α·Σq with no floor, but the floor is
// required when Σq starts at zero (otherwise b=0 and exp blows up). We use a
// piecewise floor — equivalent to keeping the bounded loss tight on a fresh
// market until users start trading.
func (s *State) liquidity() float64 {
	sumQ := 0.0
	for _, q := range s.Q {
		sumQ += q
	}
	b := s.Alpha * sumQ
	if b < s.BSeed {
		b = s.BSeed
	}
	return b
}

// SumQ returns Σ qᵢ.
func (s *State) SumQ() float64 {
	sumQ := 0.0
	for _, q := range s.Q {
		sumQ += q
	}
	return sumQ
}

// B returns the current liquidity parameter b(q).
func (s *State) B() float64 { return s.liquidity() }

// Cost returns C(q) per the LS-LMSR cost function.
//
// We compute it in a numerically-stable form using log-sum-exp:
//
//	C(q) = b · (max + ln Σ exp(qᵢ/b - max))
//
// where max = max(qᵢ/b). This avoids overflow when qᵢ/b is large.
func (s *State) Cost() float64 {
	b := s.liquidity()
	return b * logSumExp(s.Q, b)
}

// Price returns the instantaneous price p_i(q) ∈ (0, 1) of outcome i.
//
// Sum of prices over all outcomes equals 1 exactly (within float drift).
func (s *State) Price(i int) float64 {
	if i < 0 || i >= len(s.Q) {
		return 0
	}
	b := s.liquidity()
	mx := maxOver(s.Q, b)
	denom := 0.0
	for _, q := range s.Q {
		denom += math.Exp(q/b - mx)
	}
	return math.Exp(s.Q[i]/b-mx) / denom
}

// AllPrices returns the price vector. Sum equals 1.
func (s *State) AllPrices() []float64 {
	b := s.liquidity()
	mx := maxOver(s.Q, b)
	out := make([]float64, len(s.Q))
	denom := 0.0
	for _, q := range s.Q {
		denom += math.Exp(q/b - mx)
	}
	for i, q := range s.Q {
		out[i] = math.Exp(q/b-mx) / denom
	}
	return out
}

// BuyCost returns the cost to buy `dq` shares of outcome i. dq may be
// negative (sell). Pure function — does not mutate state.
func (s *State) BuyCost(i int, dq float64) float64 {
	if i < 0 || i >= len(s.Q) {
		return 0
	}
	before := s.Cost()
	s.Q[i] += dq
	after := s.Cost()
	s.Q[i] -= dq
	return after - before
}

// MaxLoss returns the worst-case loss bound for this state.
//
// Classical LMSR: b · ln(N). Our LS-LMSR uses dynamic b — but with our floor
// of BSeed and at zero outstanding shares, the bound is BSeed · ln(N). As Σq
// grows the dynamic component (α·Σq) increases proportionally but is funded
// from the spread, so the *unrecoverable* loss stays at the seeded floor.
func (s *State) MaxLoss() float64 {
	return s.BSeed * math.Log(float64(len(s.Q)))
}

// SeedFromPrices sets the q vector such that prices match the given target.
//
// Math: from p_i = exp(q_i/b) / Σ exp(q_j/b), choosing b = BSeed and
// q_i = b · ln(p_i) gives exactly that price distribution at b(q)=BSeed
// (since Σq = b · Σ ln p_i is negative — pricing remains valid because the
// liquidity floor keeps b above α·Σq when Σq ≤ 0).
//
// targets must be a length-N positive vector summing to ≈ 1. Any tiny prices
// are clamped to 1e-6 to keep ln finite.
func (s *State) SeedFromPrices(targets []float64) error {
	if len(targets) != len(s.Q) {
		return fmt.Errorf("seed: expected %d targets, got %d", len(s.Q), len(targets))
	}
	sum := 0.0
	for _, p := range targets {
		if p < 0 {
			return errors.New("seed: negative target price")
		}
		sum += p
	}
	if sum <= 0 {
		return errors.New("seed: sum of targets must be positive")
	}
	// Renormalize so we never wedge ourselves with sum != 1 input.
	for i, p := range targets {
		norm := p / sum
		if norm < 1e-6 {
			norm = 1e-6
		}
		s.Q[i] = s.BSeed * math.Log(norm)
	}
	return nil
}

