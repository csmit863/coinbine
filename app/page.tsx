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
  TokenRow
} from "@coinbase/onchainkit/token";
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { arbitrum, base, optimism, polygon, scroll } from "viem/chains";
import buttonUp from "./images/buttonup.png";
import buttonDown from "./images/buttondown.png";
import { 
  initKlaster, 
  deployment,
  loadBiconomyV2Account as loadBicoV2Account,
  buildMultichainReadonlyClient,
  buildRpcInfo,
  buildTokenMapping
 } from "klaster-sdk";

 const chainNames = {
  [optimism.id]: "Optimism",
  [base.id]: "Base",
  [polygon.id]: "Polygon",
  [arbitrum.id]: "Arbitrum",
  [scroll.id]: "Scroll",
};
 async function getMultichainBalances(connectedAccount, addLog) {
  try {
    addLog("Initializing Multichain Client...");

    // Initialize MultichainClient with multiple RPCs
    const client = buildMultichainReadonlyClient([
      buildRpcInfo(optimism.id, optimism.rpcUrls.default.http[0]),
      buildRpcInfo(base.id, base.rpcUrls.default.http[0]),
      buildRpcInfo(polygon.id, polygon.rpcUrls.default.http[0]),
      buildRpcInfo(arbitrum.id, arbitrum.rpcUrls.default.http[0]),
      buildRpcInfo(scroll.id, scroll.rpcUrls.default.http[0]),
    ]);

    // Wrap connectedAccount in an object that conforms to MultichainAccount
    const account = {
      getAddress: () => connectedAccount?.address || "", // Return address or empty string
    };

    addLog("Fetching native token balances...");
    const nativeBalance = await client.getUnifiedNativeBalance({ account });
    addLog(`Unified Native Balance: ${Number(nativeBalance) / 10**18} ETH`);

    addLog("Fetching ERC-20 token balances...");

    const mcUSDC = buildTokenMapping([
      deployment(optimism.id, "0x0b2c639c533813f4aa9d7837caf62653d097ff85"),
      deployment(base.id, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
      deployment(arbitrum.id, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
      deployment(polygon.id, "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359")
    ])

    const erc20Balance = await client.getUnifiedErc20Balance({
      tokenMapping: mcUSDC,
      account: account,
    });

    addLog(`Unified ERC-20 Balance: ${Number(erc20Balance.balance)/10**Number(erc20Balance.decimals)}`);
    erc20Balance.breakdown.forEach((b) => {
      addLog(`=== ${chainNames[Number(b.chainId)]} ===`);
      addLog(`USDC Balance: ${Number(b.amount) / 10**Number(erc20Balance.decimals)} `);
      addLog('-----')
    });

    return { nativeBalance, erc20Balance };
  } catch (error) {
    addLog(`Error fetching balances: ${error.message}`);
    throw error;
  }
}

async function swapMultichainTokens(connectedAccount, addLog, targetCoin) {
  // exchange each token on each chain into the target coin using the multichain token mappings
  addLog(`Initiating multichain swap to ${targetCoin}...`);
}

async function bridgeMultichainTokens(connectedAccount, addLog, targetChainId) {
  // bridge the merged tokens on each chain onto the target chain, completing the merge
  addLog(`Initiating multichain bridge to ${chainNames[Number(targetChainId)]}...`);

}


export default function App() {
  const connectedAccount = useAccount();
  const [isPressed, setIsPressed] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalEndRef = useRef(null);  // Ref to the terminal end (bottom)
  const [targetCoin, setTargetCoin] = useState("USDC")
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
    addLog("Button clicked. Starting transaction...");

    try {
      if (connectedAccount) {
        const balance = await getMultichainBalances(connectedAccount, addLog);
        
        addLog(`Multichain scan completed.`);
        const swapCompleted = await swapMultichainTokens(connectedAccount, addLog, targetCoin);
        addLog(`Multichain swaps completed.`);

        const bridgeCompleted = await bridgeMultichainTokens(connectedAccount, addLog, targetChain);
        addLog(`Multichain bridging completed`);

      } else {
        addLog("No wallet connected.");
      }
    } catch (error) {
      addLog(`Transaction failed: ${error.message}`);
    } finally {
      setTimeout(100);
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
        <div className="max-w-4xl w-full p-4">
          <div className="px-5 w-full flex justify-between items-start">
            <div className="flex flex-col text-left">
              <h1 className="mb-2 text-2xl">Coin merge</h1>
              <p className="text-gray-500">built with OnchainKit & Klaster</p>
              <p>Merge all your tokens across all chains into a single asset on one chain. </p>
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

          {/* Terminal */}
          {terminalVisible && (
            <div className="mt-4 p-4 bg-black text-green-500 rounded-lg max-h-64 overflow-auto">
              <div className="font-mono text-sm">
                {terminalLogs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
                {/* Empty div to act as the terminal's bottom */}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
