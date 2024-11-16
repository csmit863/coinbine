"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
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
  loadBiconomyV2Account as loadBicoV2Account,
  buildMultichainReadonlyClient,
  buildRpcInfo
 } from "klaster-sdk";

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
    addLog(`Unified Native Balance: ${nativeBalance.toString()}`);

    addLog("Fetching ERC-20 token balances...");
    const tokenMapping = [
      { chainId: optimism.id, tokenAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85" },
      { chainId: base.id, tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      { chainId: arbitrum.id, tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
      { chainId: polygon.id, tokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359" },
    ];
    const erc20Balance = await client.getUnifiedErc20Balance({
      tokenMapping,
      account,
    });

    addLog(`Unified ERC-20 Balance: ${erc20Balance.balance}`);
    erc20Balance.breakdown.forEach((b) => {
      addLog(`Chain ID: ${b.chainId}, Balance: ${b.balance}`);
    });

    return { nativeBalance, erc20Balance };
  } catch (error) {
    addLog(`Error fetching balances: ${error.message}`);
    throw error;
  }
}


export default function App() {
  const connectedAccount = useAccount();
  const [isPressed, setIsPressed] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);

  const addLog = (message) => {
    setTerminalLogs((prevLogs) => [...prevLogs, message]);
  };

  const handleClick = async () => {
    setTerminalLogs([]);
    setIsPressed(true);
    setTerminalVisible(true);
    addLog("Button clicked. Starting transaction...");

    try {
      if (connectedAccount) {
        const balance = await getMultichainBalances(connectedAccount, addLog);
        addLog(`Transaction completed. Final balance: ${balance}`);
      } else {
        addLog("No wallet connected.");
      }
    } catch (error) {
      addLog(`Transaction failed: ${error.message}`);
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
        <div className="max-w-4xl w-full p-4">
          <div className="px-5 w-full flex justify-between items-start">
            <div className="flex flex-col text-left">
              <h1 className="mb-2 text-2xl">Coinbine</h1>
              <p className="text-gray-500">built with OnchainKit & Klaster</p>
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
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
