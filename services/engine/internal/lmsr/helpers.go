package lmsr

import "math"

// priceToCents converts a 0..1 LMSR price to a 1..99 cent quote, clamped.
func priceToCents(p float64) int32 {
	c := int32(math.Round(p * 100.0))
	if c < 1 {
		return 1
	}
	if c > 99 {
		return 99
	}
	return c
}

func abs32(x int32) int32 {
	if x < 0 {
		return -x
	}
	return x
}
