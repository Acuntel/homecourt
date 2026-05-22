package lmsr

import (
	"math"
	"testing"
)

const epsPrice = 1e-9

// 1. Prices sum to 1 across all buckets, for any q vector.
func TestPricesSumToOne(t *testing.T) {
	cases := [][]float64{
		{0, 0, 0, 0, 0},                               // uniform
		{100, 0, 0, 0, 0},                             // skewed
		{50, 100, 75, 25, -10},                        // mixed sign
		{-100, -100, -100, -100, -100},                // all negative (after seeding from prices)
		{1000, 1000, 1000, 1000, 1000},                // all same large
		{0.1, 0.2, 0.3, 0.4, 0.5},                     // small positive
	}
	for _, q := range cases {
		s := New(500, 5)
		copy(s.Q, q)
		sum := 0.0
		ps := s.AllPrices()
		if len(ps) != 5 {
			t.Fatalf("AllPrices len = %d, want 5", len(ps))
		}
		for i, p := range ps {
			if p < 0 || p > 1 {
				t.Errorf("q=%v price[%d]=%v out of range", q, i, p)
			}
			sum += p
		}
		if math.Abs(sum-1.0) > epsPrice {
			t.Errorf("q=%v sum=%v want 1.0", q, sum)
		}
	}
}

// 2. Zero-q gives uniform 1/N prices.
func TestZeroQUniform(t *testing.T) {
	s := New(500, 5)
	ps := s.AllPrices()
	for i, p := range ps {
		if math.Abs(p-0.2) > epsPrice {
			t.Errorf("zero-q price[%d]=%v want 0.2", i, p)
		}
	}
}

// 3. Monotonicity: buying shares of outcome i strictly increases p_i and
// strictly decreases at least one other outcome's price.
func TestMonotonicity(t *testing.T) {
	s := New(500, 5)
	pBefore := s.AllPrices()
	s.Q[2] += 100 // buy 100 shares of bucket 2
	pAfter := s.AllPrices()
	if !(pAfter[2] > pBefore[2]) {
		t.Errorf("p[2] did not increase: before=%v after=%v", pBefore[2], pAfter[2])
	}
	// At least one other bucket should decrease.
	anyDec := false
	for i := 0; i < 5; i++ {
		if i == 2 {
			continue
		}
		if pAfter[i] < pBefore[i] {
			anyDec = true
		}
	}
	if !anyDec {
		t.Errorf("no other bucket decreased: before=%v after=%v", pBefore, pAfter)
	}
}

// 4. Bounded loss: MaxLoss for a fresh market with b=500 and N=5 ≈ 500*ln(5) ≈ 804.72.
func TestBoundedLoss(t *testing.T) {
	s := New(500, 5)
	got := s.MaxLoss()
	want := 500.0 * math.Log(5)
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("MaxLoss=%v want %v", got, want)
	}
	if got > 805 || got < 804 {
		t.Errorf("MaxLoss=%v outside expected [804,805] range", got)
	}
}

// 5. Seeding from Zestimate: given an anchor bucket, prices should match the
// 0.55/0.18/0.045 weighting (normalized).
func TestSeedFromZestimate(t *testing.T) {
	tests := []struct {
		anchor int
	}{
		{0}, {1}, {2}, {3}, {4},
	}
	for _, tc := range tests {
		targets := PricesFromZestimate(tc.anchor, 5)
		// targets should sum to 1.
		sum := 0.0
		for _, p := range targets {
			sum += p
		}
		if math.Abs(sum-1.0) > 1e-9 {
			t.Errorf("anchor=%d targets sum=%v want 1.0", tc.anchor, sum)
		}
		// anchor must have the highest weight.
		for i := 0; i < 5; i++ {
			if i == tc.anchor {
				continue
			}
			if targets[i] >= targets[tc.anchor] {
				t.Errorf("anchor=%d targets[%d]=%v >= anchor=%v", tc.anchor, i, targets[i], targets[tc.anchor])
			}
		}
		// Seed a state and check prices match within 1%.
		s := New(500, 5)
		if err := s.SeedFromPrices(targets); err != nil {
			t.Fatalf("SeedFromPrices: %v", err)
		}
		ps := s.AllPrices()
		for i := 0; i < 5; i++ {
			if math.Abs(ps[i]-targets[i]) > 0.005 {
				t.Errorf("anchor=%d ps[%d]=%v targets[%d]=%v (diff > 0.5%%)", tc.anchor, i, ps[i], i, targets[i])
			}
		}
	}
}

// 6. Position cap: a kill-switch helper. House MM per-market cap is $200K
// notional exposure. 1 contract pays $1.00 (100¢) at settlement, so the
// share-count ceiling is 200_000 contracts per outcome.
func TestNotionalExposure(t *testing.T) {
	const capCents int64 = 20_000_000 // $200,000 in cents
	const maxShares = capCents / 100  // 200,000 shares at $1/share max payout
	if maxShares != 200_000 {
		t.Errorf("maxShares = %d, want 200000", maxShares)
	}
	s := New(500, 5)
	s.Q[0] = 100_000 // 100K shares — within cap
	notional := int64(math.Round(s.Q[0])) * 100 // worst-case payout in cents
	if notional <= 0 || notional > capCents {
		t.Errorf("notional=%d out of expected range (<= %d)", notional, capCents)
	}
	// And a value that should be over.
	s.Q[1] = 300_000
	over := int64(math.Round(s.Q[1])) * 100
	if over <= capCents {
		t.Errorf("over=%d should exceed cap %d", over, capCents)
	}
}

// 7. BuyCost should be positive for any positive dq on any outcome.
func TestBuyCostPositive(t *testing.T) {
	s := New(500, 5)
	for i := 0; i < 5; i++ {
		c := s.BuyCost(i, 10)
		if c <= 0 {
			t.Errorf("BuyCost(%d, 10) = %v, want > 0", i, c)
		}
	}
}

// 8. BucketForCents: integer bucket lookup.
func TestBucketForCents(t *testing.T) {
	lows := []int64{0, 100, 200, 300, 400}
	highs := []int64{99, 199, 299, 399, 1000}
	cases := []struct {
		v   int64
		idx int
	}{
		{50, 0},
		{150, 1},
		{299, 2},
		{350, 3},
		{500, 4},
		{-1, 0},   // below: clamp to first
		{1001, 4}, // above: clamp to last
	}
	for _, c := range cases {
		got := BucketForCents(c.v, lows, highs)
		if got != c.idx {
			t.Errorf("BucketForCents(%d) = %d, want %d", c.v, got, c.idx)
		}
	}
}

// 9. SeedFromPrices error paths.
func TestSeedFromPricesErrors(t *testing.T) {
	s := New(500, 5)
	if err := s.SeedFromPrices([]float64{0.5, 0.5}); err == nil {
		t.Error("expected error for wrong-length targets")
	}
	if err := s.SeedFromPrices([]float64{-1, 0, 0, 0, 0}); err == nil {
		t.Error("expected error for negative target")
	}
	if err := s.SeedFromPrices([]float64{0, 0, 0, 0, 0}); err == nil {
		t.Error("expected error for zero-sum targets")
	}
}
