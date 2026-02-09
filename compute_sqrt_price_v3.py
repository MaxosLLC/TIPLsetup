import mpmath

# Use very high precision for the sqrt step
mpmath.mp.dps = 500

TWO_96 = mpmath.mpf(2) ** 96

def compute_sqrt_price_x96(tick):
    """
    Compute floor(sqrt(1.0001^tick) * 2^96) with exact integer arithmetic
    for the exponentiation, and mpmath only for the final square root.
    
    1.0001 = 10001/10000
    
    For tick >= 0:
      ratio = 10001^tick / 10000^tick
      sqrtPriceX96 = floor(sqrt(10001^tick / 10000^tick) * 2^96)
                   = floor(sqrt(10001^tick) * 2^96 / sqrt(10000^tick))
    
    For tick < 0 (tick = -n):
      ratio = 10000^n / 10001^n
      sqrtPriceX96 = floor(sqrt(10000^n / 10001^n) * 2^96)
    
    We can compute 10001^n and 10000^n as exact Python integers,
    then use mpmath for the sqrt of the ratio.
    """
    n = abs(tick)
    
    # Exact integer exponentiation
    num_int = 10001 ** n if tick >= 0 else 10000 ** n
    den_int = 10000 ** n if tick >= 0 else 10001 ** n
    
    # Convert to mpmath for the sqrt
    # To maximize precision, compute sqrt(num/den) = sqrt(num) / sqrt(den)
    # But better: compute the fraction as mpf first
    ratio = mpmath.mpf(num_int) / mpmath.mpf(den_int)
    sqrt_ratio = mpmath.sqrt(ratio)
    result = sqrt_ratio * TWO_96
    return int(result)

# Known correct values from the contract
known_values = {
    -322400: 7_914_118_485_757_900_357_632,
    -253400: 249_254_842_934_311_822_295_040,
     253400: 25_183_469_503_242_882_170_212_176_944_431_104,
     322400: 793_152_347_588_122_760_560_699_178_810_867_712,
}

all_ticks = [-322400, -253400, -207400, 207400, 253400, 322400]

print("=" * 80)
print("sqrtPriceX96 Computation v3 (mpmath dps={})".format(mpmath.mp.dps))
print("Using exact integer pow for 10001^n and 10000^n")
print("Formula: floor(sqrt((10001/10000)^tick) * 2^96)")
print("=" * 80)
print()

results = {}
all_match = True
for tick in all_ticks:
    print("Computing tick {}...".format(tick), flush=True)
    val = compute_sqrt_price_x96(tick)
    results[tick] = val

    status = ""
    if tick in known_values:
        expected = known_values[tick]
        if val == expected:
            status = "  [MATCH]"
        else:
            status = "  [MISMATCH]  expected: {}".format(expected)
            status += "\n              diff: {}".format(val - expected)
            all_match = False

    print("tick {:>8d}:  {}{}".format(tick, val, status))

print()
if all_match:
    print("All cross-check values MATCH.")
else:
    print("WARNING: Some cross-check values do NOT match.")

print()
print("=" * 80)
print("Values needed:")
print("=" * 80)
for tick in [-207400, 207400]:
    val = results[tick]
    print()
    print("tick {}:".format(tick))
    print("  decimal:          {}".format(val))
    print("  with underscores: {}".format(format(val, '_')))
    print("  hex:              0x{:x}".format(val))
    print("  bit length:       {}".format(val.bit_length()))
