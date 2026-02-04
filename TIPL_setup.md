The TIPLsetup smart contract will create a new TIPL token with a multisig treasury and an optional Uniswap V4 swap pool. I want to make a single function call that will run multiple steps. The contract implements a function to setupTIPL

The inputs to setupTIPL are:

* Token symbol  
* Token name  
* First multisig signer. This is the message sender by default.  
* Second multisig signer. This can be empty  
* Create\_swap. This can be true or false. If it is true, we will create  a Uniswap V4 swap pool

The outputs are 

* New multisig treasury address  
* an optional Uniswap pool ID

## STEP 1: Make a Safe.global multisig treasury

Use the SAFE factory. If the second signer is empty, then create a multisig with 1 of 1 signing, with the first signer. If the second signer is not empty, then create a multisig with 2 of 2 signing, with the first and second signer.

## STEP 2: Make a token

Make a token with the token symbol and the token name. It will mint 1000000 tokens. Send them to self.

## STEP 3: Send 5% of the tokens to the TIPL treasury

Send 50000 tokens to 0xF698340aa648DCF6bAbDeb93B0878A08755Bcd69

## STEP 4: Create a Uniswap V4 pool

If create\_swap is true, create a Uniswap V4 pool with USDC and the new token. Create an LP position in this pool with 200000 tokens placed for single-sided sale in a price range from .01 USDC to 10 USDC

Send the LP NFT to the multisig treasury

## STEP 5: Send all remaining tokens to the multisig treasury

Send  all remaining tokens to the multisig treasury  
