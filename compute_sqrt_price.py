import mpmath

# Set very high precision - 200 decimal digits
mpmath.mp.dps = 200

TWO_96 = mpmath.mpf(2) ** 96

def compute_sqrt_price_x96(tick):
    """Compute floor(sqrt(1.0001^tick) * 2^96) with high precision."""
    base = mpmath.mpf("1.0001")
    ratio = mpmath.power(base, tick)
    sqrt_ratio = mpmath.sqrt(ratio)
    result = sqrt_ratio * TWO_96
    return int(result)  # int() on mpmath mpf truncates toward zero (floor for positive)

# Known correct values from the contract
known_values = {
    -322400: 7_914_118_485_757_900_357_632,
    -253400: 249_254_842_934_311_822_295_040,
     253400: 25_183_469_503_242_882_170_212_176_944_431_104,
     322400: 793_152_347_588_122_760_560_699_178_810_867_712,
}

# Ticks to compute
all_ticks = [-322400, -253400, -207400, 207400, 253400, 322400]

print("=" * 80)
print("sqrtPriceX96 Computation  (mpmath precision: {} decimal digits)".format(mpmath.mp.dps))
print("Formula: floor(sqrt(1.0001^tick) * 2^96)")
print("=" * 80)
print()

results = {}
for tick in all_ticks:
    val = compute_sqrt_price_x96(tick)
    results[tick] = val

    # Check against known values
    status = ""
    if tick in known_values:
        expected = known_values[tick]
        if val == expected:
            status = "  [MATCH]"
        else:
            status = "  [MISMATCH]  expected: {}".format(expected)
            status += "\n              diff: {}".format(val - expected)

    print("tick {:>8d}:  {}{}".format(tick, val, status))

print()
print("=" * 80)
print("Values needed for contract:")
print("=" * 80)
for tick in [-207400, 207400]:
    val = results[tick]
    print()
    print("tick {}:".format(tick))
    print("  decimal:     {}".format(val))
    print("  with underscores: {}".format(format(val, '_')))
    print("  hex:         0x{:x}".format(val))
    print("  bit length:  {}".format(val.bit_length()))

print()
print("=" * 80)
print("Solidity-friendly format:")
print("=" * 80)
for tick in [-207400, 207400]:
    val = results[tick]
    print("tick {:>8d}:  {}".format(tick, format(val, '_')))
