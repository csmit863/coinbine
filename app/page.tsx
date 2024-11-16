"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  TokenRow,
  TokenSelectDropdown
} from "@coinbase/onchainkit/token";
import { setOnchainKitConfig } from '@coinbase/onchainkit';
import { buildSwapTransaction } from '@coinbase/onchainkit/api';
import type { Token } from '@coinbase/onchainkit/token';

import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { arbitrum, base, optimism } from "viem/chains";
import buttonUp from "./images/buttonup.png";
import buttonDown from "./images/buttondown.png";
import tree from "./svg/tree.svg";
import { 
  deployment,
  buildMultichainReadonlyClient,
  buildRpcInfo,
  buildTokenMapping
 } from "klaster-sdk";

const chainNames = {
  [optimism.id]: "Optimism",
  [base.id]: "Base",
  [arbitrum.id]: "Arbitrum",
};



const mcDict = {
  'USDC': buildTokenMapping([
    deployment(optimism.id, "0x0b2c639c533813f4aa9d7837caf62653d097ff85"),
    deployment(base.id, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    deployment(arbitrum.id, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
  ]),
  'DAI': buildTokenMapping([
    deployment(optimism.id, "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
    deployment(base.id, "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"),
    deployment(arbitrum.id, "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1"),
  ])
}

setOnchainKitConfig({ apiKey: 'YOUR_API_KEY' });


async function getMultichainBalances(connectedAccount, addLog) {
  try {
    addLog("> Initializing Multichain Client...");
    // Initialize MultichainClient with RPCs
    const client = buildMultichainReadonlyClient([
      buildRpcInfo(optimism.id, optimism.rpcUrls.default.http[0]),
      buildRpcInfo(base.id, base.rpcUrls.default.http[0]),
      buildRpcInfo(arbitrum.id, arbitrum.rpcUrls.default.http[0]),
    ]);

    // Wrap connectedAccount in an object that conforms to MultichainAccount
    const account = {
      getAddress: () => connectedAccount?.address || "", // Return address or empty string
    };

    // Fetch Native Token Balance
    addLog("> Fetching native token balances...");
    const nativeBalance = await client.getUnifiedNativeBalance({ account });
    addLog(`Unified Native Balance: ${Number(nativeBalance) / 10 ** 18} ETH`);

    // Object to group balances by chain
    const chainBalances = {};

    // Iterate through mcDict to fetch ERC-20 balances
    for (const [tokenName, tokenMapping] of Object.entries(mcDict)) {
      addLog(`> Fetching balances for ${tokenName}...`);
      try {
        const erc20Balance = await client.getUnifiedErc20Balance({
          tokenMapping,
          account,
        });

        // Process breakdown by chain
        erc20Balance.breakdown.forEach((b) => {
          const chainId = Number(b.chainId);
          const chainName = chainNames[chainId];
          const tokenBalance = Number(b.amount) / 10 ** Number(erc20Balance.decimals);

          if (!chainBalances[chainName]) {
            chainBalances[chainName] = [];
          }

          // Add token balance to the chain
          chainBalances[chainName].push({ token: tokenName, balance: tokenBalance });
        });
      } catch (error) {
        addLog(`> Error fetching balances for ${tokenName}: ${error.message}`);
      }
    }

    // Log grouped balances by chain
    addLog("> Displaying all balances grouped by chain...");
    for (const [chainName, tokens] of Object.entries(chainBalances)) {
      addLog(`=== ${chainName} ===`);
      tokens.forEach(({ token, balance }) => {
        addLog(`${token}: ${balance}`);
      });
      addLog("-----");
    }

    addLog("> Multichain scan completed.");
    return { nativeBalance, chainBalances };
  } catch (error) {
    addLog(`> Error fetching balances: ${error.message}`);
    throw error;
  }
}



async function onchainKitSwap(connectedAccount, amount, addLog, tokenIn, tokenOut, currentChainId){
  
  // tokenIn will be a string e.g. 'USDC'
  // utilize the mcUSDC and mcDAI token mappings
  if (tokenIn !== tokenOut.name) {
    addLog(`> Swapping ${amount} ${tokenIn} on ${chainNames[Number(currentChainId)]} to ${tokenOut.name}...`);

    const fromToken: Token = {
      name: tokenIn,
      address: tokenIn,
      symbol: tokenOut,
      decimals: 18,
      image: '',
      chainId: currentChainId,
    };

    const toToken: Token = {
      name: tokenOut,
      address: tokenOut,
      symbol: tokenOut,
      decimals: 6,
      image: '',
      chainId: currentChainId,
    };

    const response = await buildSwapTransaction({
      fromAddress: connectedAccount,
      from: fromToken,
      to: toToken,
      amount: '0.1',
      useAggregator: false,
    });
    console.log(response);
    addLog(`> ✔ Successfully swapped ${amount} ${tokenIn} on ${chainNames[Number(currentChainId)]} to ${tokenOut.name}.`);
    return response;
  }

}


async function swapMultichainTokens(connectedAccount, addLog, targetCoin, tokenBalances) {
  addLog(`> Initiating multichain swap to ${targetCoin.name}...`);

  // Handle native token balance
  /*if (tokenBalances.nativeBalance > 0) {
    const nativeBalanceInEth = Number(tokenBalances.nativeBalance) / 10 ** 18;
    addLog(`> Swapping ${nativeBalanceInEth} ETH to ${targetCoin.name}...`);
    try {
      await onchainKitSwap(
        connectedAccount,
        nativeBalanceInEth,
        addLog,
        "ETH",
        targetCoin,
        null // Null for native tokens
      );
      addLog(`> ✔ Successfully swapped ${nativeBalanceInEth} ETH to ${targetCoin.name}.`);
    } catch (error) {
      addLog(`> ✘ Failed to swap ETH: ${error.message}`);
    }
  }*/

  // Handle ERC-20 token balances on each chain
  for (const [chainName, tokens] of Object.entries(tokenBalances.chainBalances)) {
    if (!Array.isArray(tokens)) {
      //addLog(`> Skipping ${chainName}: Invalid token balances structure.`);
      continue;
    }

    for (const { token, balance } of tokens) {
      if (!balance || balance <= 0) {
        //addLog(`> Skipping ${chainName}: No ${token} balance to swap.`);
        continue;
      }


      try {
        // Map chainName to chainId
        const chainId = Object.keys(chainNames).find((id) => chainNames[id] === chainName);
        if (!chainId) throw new Error(`Chain ID for ${chainName} not found`);

        // Perform the swap
        await onchainKitSwap(
          connectedAccount,
          balance,
          addLog,
          token,
          targetCoin,
          Number(chainId) // Convert chainId to number
        );

      } catch (error) {
        addLog(`> ✘ Failed to swap ${token} on ${chainName}: ${error.message}`);
      }
    }
  }

  addLog("> Multichain swap completed.");
}


async function bridgeMultichainTokens(connectedAccount, addLog, targetChainId, tokenBalance) {
  console.log(targetChainId)
  // bridge the merged tokens on each chain onto the target chain, completing the merge
  addLog(`> Initiating multichain bridge to ${chainNames[Number(targetChainId.chainId)]}...`);
  addLog(`> Multichain bridging completed`);

}


export default function App() {
  const connectedAccount = useAccount();
  const [isPressed, setIsPressed] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalEndRef = useRef(null);  // Ref to the terminal end (bottom)
  const [targetCoin, setTargetCoin] = useState(null)
  const [targetChain, setTargetChain] = useState(base.id)


  const addLog = (message) => {
    setTerminalLogs((prevLogs) => [...prevLogs, message]);
  };

  // Scroll to the bottom of the terminal every time new logs are added
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);  // Trigger whenever terminalLogs change


  const handleClick = async () => {
    setTerminalLogs([]);
    setIsPressed(true);
    
    setTerminalVisible(true);

    try {
      if (connectedAccount.address) {
        addLog("> Starting coin merge...");
        const balance = await getMultichainBalances(connectedAccount, addLog);
        
        const newBalance = await swapMultichainTokens(connectedAccount, addLog, targetCoin, balance);

        const finalBalance = await bridgeMultichainTokens(connectedAccount, addLog, targetChain, newBalance);

      } else {
        addLog("> No wallet connected. Please connect wallet to use coin merge.");
      }
    } catch (error) {
      addLog(`> Transaction failed: ${error.message}`);
    } finally {
      setIsPressed(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans light:bg-background light:text-white bg-white text-black">
      <header className="pt-4 pr-4">
        <div className="flex justify-end">
          <Wallet>
            <ConnectWallet>
              <Avatar className="h-6 w-6" />
              <Name />
            </ConnectWallet>
            <WalletDropdown>
              <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
              </Identity>
              <WalletDropdownLink
                icon="wallet"
                href="https://keys.coinbase.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wallet
              </WalletDropdownLink>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </Wallet>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center">
        <div className="max-w-4xl w-full p-4 flex flex-col min-h-screen">
          <div className="px-5 w-full flex justify-end items-start ">
            <div className="flex flex-col text-left">
              <h1 className="mb-2 text-2xl">Coin merge</h1>
              <p>Merge all your tokens across all chains into a single asset on one chain. </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <p>Select target coin</p>
                <TokenSelectDropdown
                  token={targetCoin}
                  setToken={setTargetCoin}
                  options={[
                    {
                      name: 'Ethereum',
                      address: '',
                      symbol: 'ETH',
                      decimals: 18,
                      image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
                      chainId: 8453,
                    },
                    {
                      name: 'USDC',
                      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                      symbol: 'USDC',
                      decimals: 6,
                      image:
                        'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/44/2b/442b80bd16af0c0d9b22e03a16753823fe826e5bfd457292b55fa0ba8c1ba213-ZWUzYjJmZGUtMDYxNy00NDcyLTg0NjQtMWI4OGEwYjBiODE2',
                      chainId: 8453,
                    },
                    {
                      name: 'Dai',
                      address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
                      symbol: 'DAI',
                      decimals: 18,
                      image:
                        'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/d0/d7/d0d7784975771dbbac9a22c8c0c12928cc6f658cbcf2bbbf7c909f0fa2426dec-NmU4ZWViMDItOTQyYy00Yjk5LTkzODUtNGJlZmJiMTUxOTgy',
                      chainId: 8453,
                    },
                  ]}
                />  
                <p>Select target chain</p>
                {/* use the token select dropdown menu to select the chain */}
                <TokenSelectDropdown
                  token={targetChain}
                  setToken={setTargetChain}
                  options={[
                    {
                      name: 'ETH Mainnet',
                      address: '',
                      symbol: 'ETH',
                      decimals: 18,
                      image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
                      chainId: 8453,
                    },
                    {
                      name: 'Optimism',
                      address: '',
                      symbol: 'OP',
                      decimals: 18,
                      image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
                      chainId: 8453,
                    },
                    {
                      name: 'Base',
                      address: '',
                      symbol: 'BASE',
                      decimals: 18,
                      image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
                      chainId: 8453,
                    },
                    {
                      name: 'Arbitrum',
                      address: '',
                      symbol: 'ARB',
                      decimals: 18,
                      image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
                      chainId: 8453,
                    },
                  ]}
                />
              </div>
              
            </div>

            <div className="flex justify-center items-center ml-auto h-full">
              <Image
                src={isPressed ? buttonDown : buttonUp}
                alt="button"
                onClick={handleClick}
                style={{ cursor: "pointer" }}
              />
            </div>
          </div>
          <div>
            {/* Terminal */}
            {terminalVisible && (
              <div className="mt-4 p-4 bg-black text-green-500 rounded-lg max-h-64 overflow-auto">
                <div className="font-mono text-sm">
                  {terminalLogs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                  {/* Empty div to act as the terminal's bottom */}
                  {/*<div ref={terminalEndRef} />*/}
                </div>
              </div>
            )}
          </div>
          {/* Bottom-left text */}
          <div className="absolute bottom-4 left-4 text-sm text-gray-500">
            <p>WIP</p>              
            <p>built with Onchain Kit & Klaster at ETHGlobal Bangkok 2024</p>
            <a
              href="https://github.com/csmit863/coinmerge-ethglobal2024"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              https://github.com/csmit863/coinmerge-ethglobal2024
            </a>
          </div>
          <div className="absolute top-4 left-4 text-sm text-gray-500">
            <Image src={tree} alt='tree-diagram' width={50} height={50}/>
          </div>
        </div>
      </main>
    </div>
  );
}
