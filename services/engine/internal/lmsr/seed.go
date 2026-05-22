package lmsr

import "math"

// PricesFromZestimate returns the target price vector for a 5-bucket market
// where the Zestimate falls into anchorIdx. Weights per spec:
//
//	anchor:     0.55
//	adjacent:   0.18 each (|idx-anchor| == 1)
//	outer:      0.045 each (|idx-anchor| >= 2)
//
// For anchors at the edge (0 or N-1) the raw weights don't sum to 1, so the
// output is renormalized.
func PricesFromZestimate(anchorIdx, nBuckets int) []float64 {
	if nBuckets <= 0 {
		nBuckets = 5
	}
	if anchorIdx < 0 {
		anchorIdx = 0
	}
	if anchorIdx >= nBuckets {
		anchorIdx = nBuckets - 1
	}
	const (
		wAnchor   = 0.55
		wAdjacent = 0.18
		wOuter    = 0.045
	)
	out := make([]float64, nBuckets)
	for i := 0; i < nBuckets; i++ {
		dist := i - anchorIdx
		if dist < 0 {
			dist = -dist
		}
		switch dist {
		case 0:
			out[i] = wAnchor
		case 1:
			out[i] = wAdjacent
		default:
			out[i] = wOuter
		}
	}
	sum := 0.0
	for _, v := range out {
		sum += v
	}
	for i := range out {
		out[i] /= sum
	}
	return out
}

// BucketForCents returns the index in buckets whose [LowCents, HighCents]
// range contains v. If v is below the first bucket, returns 0; above the
// last, returns nBuckets-1. lows + highs must be length-N and monotonic.
func BucketForCents(v int64, lows, highs []int64) int {
	if len(lows) == 0 || len(lows) != len(highs) {
		return 0
	}
	if v < lows[0] {
		return 0
	}
	if v > highs[len(highs)-1] {
		return len(lows) - 1
	}
	for i := 0; i < len(lows); i++ {
		if v >= lows[i] && v <= highs[i] {
			return i
		}
	}
	return len(lows) / 2
}

// --- internal numerics ------------------------------------------------------

// logSumExp returns ln Σ exp(qᵢ/b) in a numerically-stable form.
func logSumExp(q []float64, b float64) float64 {
	if len(q) == 0 {
		return math.Inf(-1)
	}
	mx := q[0] / b
	for _, v := range q[1:] {
		if v/b > mx {
			mx = v / b
		}
	}
	sum := 0.0
	for _, v := range q {
		sum += math.Exp(v/b - mx)
	}
	return mx + math.Log(sum)
}

// maxOver returns max(qᵢ/b).
func maxOver(q []float64, b float64) float64 {
	if len(q) == 0 {
		return 0
	}
	mx := q[0] / b
	for _, v := range q[1:] {
		if v/b > mx {
			mx = v / b
		}
	}
	return mx
}
