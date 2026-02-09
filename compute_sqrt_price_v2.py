import mpmath

# Set extremely high precision - 300 decimal digits to be safe
mpmath.mp.dps = 300

TWO_96 = mpmath.power(2, 96)

def compute_sqrt_price_x96(tick):
    """
    Compute floor(sqrt(1.0001^tick) * 2^96) with high precision.
    
    Use rational base: 1.0001 = 10001/10000 to avoid any decimal conversion error.
    For negative ticks: 1.0001^(-n) = 10000^n / 10001^n
    """
    n = abs(tick)
    
    # Compute using exact integer arithmetic for the ratio,
    # then use mpmath only for the sqrt at the very end.
    # 
    # ratio = (10001/10000)^tick
    # sqrtRatio = sqrt(ratio)
    # result = floor(sqrtRatio * 2^96)
    #
    # For positive tick:
    #   ratio = 10001^tick / 10000^tick
    #   sqrtRatio * 2^96 = sqrt(10001^tick) / sqrt(10000^tick) * 2^96
    #                    = sqrt(10001^tick) * 2^96 / (10000^(tick/2))
    #
    # Since tick can be odd, let's use mpmath with the rational directly.
    
    num = mpmath.mpf(10001)
    den = mpmath.mpf(10000)
    
    if tick >= 0:
        ratio = mpmath.power(num, tick) / mpmath.power(den, tick)
    else:
        ratio = mpmath.power(den, n) / mpmath.power(num, n)
    
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
print("sqrtPriceX96 Computation v2 (mpmath dps={})".format(mpmath.mp.dps))
print("Using rational base: 1.0001 = 10001/10000")
print("Formula: floor(sqrt((10001/10000)^tick) * 2^96)")
print("=" * 80)
print()

results = {}
all_match = True
for tick in all_ticks:
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
