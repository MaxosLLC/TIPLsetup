from decimal import Decimal, getcontext

getcontext().prec = 100

def sqrt_price_x96(tick):
    base = Decimal("1.0001")
    power = base ** tick
    sqrt_val = power.sqrt()
    q96 = Decimal(2) ** 96
    result = int(sqrt_val * q96)
    return result

ticks = [
    (-207400, "NEW lower tick"),
    ( 207400, "NEW upper tick"),
    (-322400, "existing lower (cross-check)"),
    (-253400, "existing (cross-check)"),
    ( 253400, "existing (cross-check)"),
    ( 322400, "existing upper (cross-check)"),
]

for tick, label in ticks:
    val = sqrt_price_x96(tick)
    print(f"tick {tick:>8}  ({label})")
    print(f"  sqrtPriceX96 = {val}")
    print()
