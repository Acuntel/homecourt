// Package lmsr is a placeholder for the LS-LMSR house market maker.
// Full implementation lands in M11 (see BUILD.md §10b / §23 M11).
//
// For M6, Quote returns no liquidity so the matching engine simply runs the
// CLOB without any house quotes.
package lmsr

// Quote is one side of a synthetic order book level. Reserved.
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

// State holds the LS-LMSR parameters for one market. In M11 this becomes
// {alpha, b, q[5]}; for M6 it's empty.
type State struct{}

// New returns an empty LMSR state.
func New(_ float64, _ int) *State { return &State{} }

// Quote returns the synthetic ladders the LMSR maker would post. M6: empty.
func (s *State) Quote() MarketQuote { return MarketQuote{} }
