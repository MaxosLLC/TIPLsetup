// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

type Currency is address;

using {equals as ==} for Currency global;

function equals(Currency a, Currency b) pure returns (bool) {
    return Currency.unwrap(a) == Currency.unwrap(b);
}
