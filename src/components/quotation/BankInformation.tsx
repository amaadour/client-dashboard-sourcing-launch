import React, { useState } from 'react';
import Image from 'next/image';

export type BankType = 'PAYONEER' | 'WISE' | 'AIRWALLEX' | 'WIRE' | 'BINANCE';

interface BankInformationProps {
  bank: BankType;
}

interface BankDetails {
  name: string;
  logo?: string;
  currency: string;
  // common
  email?: string;
  accountName?: string;
  accountNumber?: string;
  // airwallex
  alternativeAccountName?: string;
  // wire
  holderName?: string;
  bankName?: string;
  bankLocationCountry?: string;
  bankAddress?: string;
  accountType?: string;
  swift?: string;
  bankCode?: string;
  branchNumber?: string;
  // binance
  binanceId?: string;
  walletAddress?: string;
  network?: string;
}

const bankInformation: Record<BankType, BankDetails> = {
  PAYONEER: {
    name: 'Payoneer',
    logo: '/images/banks/payoneer.svg',
    email: 'Mehdi@sourcinglaunch.com',
    currency: 'USD',
  },
  WISE: {
    name: 'Wise',
    logo: '/images/banks/wise1.svg',
    email: 'Mehdi@sourcinglaunch.com',
    currency: 'USD',
  },
  AIRWALLEX: {
    name: 'Airwallex',
    logo: '/images/banks/airwallex.png',
    accountNumber: '1011108303257824',
    alternativeAccountName: 'Dongguan Caiqi Supply Chain Co., Ltd.',
    currency: 'USD',
  },
  WIRE: {
    name: 'Wire Bank Transfer',
    logo: '/images/banks/bank-wire.png',
    accountNumber: '7982930215',
    holderName: 'Dongguan Caiqi Supply Chain Co., Ltd.',
    bankName: 'DBS BANK (HONG KONG) LIMITED',
    bankLocationCountry: 'HONG KONG, CHINA',
    bankAddress: '11th Floor, The Center, 99 Queen\'s Road Central, Central, Hong Kong',
    accountType: 'Current',
    swift: 'DHBKHKHH',
    bankCode: '016',
    branchNumber: '478',
    currency: 'USD',
  },
  BINANCE: {
    name: 'Binance',
    logo: '/images/banks/Binance_Logo.svg.png',
    binanceId: '353293752',
    accountName: 'SOURCING LAUNCH LTD',
    walletAddress: '0x236f536f5d68184073057259b1a4da495a28e8a8',
    network: 'BNB Smart Chain (BEP20)',
    currency: 'USDT',
  },
};

const Row = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[#E3F2FD] last:border-0">
      <div className="min-w-0">
        <span className="block text-xs text-[#0D47A1]/50 uppercase tracking-wide font-medium">{label}</span>
        <span className="block text-sm font-semibold text-gray-800 mt-0.5 break-all">{value}</span>
      </div>
      <button
        onClick={copy}
        title="Copy"
        className="flex-shrink-0 mt-1 p-1.5 rounded-lg hover:bg-[#E3F2FD] transition-colors text-[#0D47A1]/50 hover:text-[#0D47A1]"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

const BankInformation: React.FC<BankInformationProps> = ({ bank }) => {
  const info = bankInformation[bank];

  const buildCopyText = () => {
    const lines: string[] = [`=== ${info.name} ===`];
    if (info.email) lines.push(`Email: ${info.email}`);
    if (info.accountName) lines.push(`Name: ${info.accountName}`);
    if (info.accountNumber) lines.push(`Account Number: ${info.accountNumber}`);
    if (info.alternativeAccountName) lines.push(`Alternative Account Name: ${info.alternativeAccountName}`);
    if (info.holderName) lines.push(`Holder Name: ${info.holderName}`);
    if (info.bankName) lines.push(`Bank Name: ${info.bankName}`);
    if (info.bankLocationCountry) lines.push(`Bank Location Country: ${info.bankLocationCountry}`);
    if (info.bankAddress) lines.push(`Bank Address: ${info.bankAddress}`);
    if (info.accountType) lines.push(`Account Type: ${info.accountType}`);
    if (info.swift) lines.push(`Swift/BIC: ${info.swift}`);
    if (info.bankCode) lines.push(`Bank Code: ${info.bankCode}`);
    if (info.branchNumber) lines.push(`Branch Number: ${info.branchNumber}`);
    if (info.binanceId) lines.push(`Binance ID: ${info.binanceId}`);
    if (info.walletAddress) lines.push(`Wallet: ${info.walletAddress}`);
    if (info.network) lines.push(`Network: ${info.network}`);
    lines.push(`Currency: ${info.currency}`);
    return lines.join('\n');
  };

  const [allCopied, setAllCopied] = useState(false);
  const copyAll = () => {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 1500);
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {info.logo ? (
            <div className="relative w-6 h-6 flex-shrink-0">
              <Image src={info.logo} alt={info.name} fill className="object-contain" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-[#0D47A1] flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          )}
          <span className="text-sm font-bold text-[#0D47A1]">{info.name}</span>
          <span className="text-xs text-[#0D47A1]/40 font-medium">{info.currency}</span>
        </div>
        <button
          onClick={copyAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBDEFB] text-xs font-medium text-[#0D47A1] hover:bg-[#E3F2FD] transition-colors"
        >
          {allCopied ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {allCopied ? 'Copied!' : 'Copy All'}
        </button>
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-[#BBDEFB] overflow-hidden bg-white divide-y-0 px-3">
        {info.email && <Row label="Email" value={info.email} />}
        {info.accountName && <Row label="Name" value={info.accountName} />}
        {info.accountNumber && <Row label="Account Number" value={info.accountNumber} />}
        {info.alternativeAccountName && <Row label="Alternative Account Name" value={info.alternativeAccountName} />}
        {info.holderName && <Row label="Holder Name" value={info.holderName} />}
        {info.bankName && <Row label="Bank Name" value={info.bankName} />}
        {info.bankLocationCountry && <Row label="Bank Location Country" value={info.bankLocationCountry} />}
        {info.bankAddress && <Row label="Bank Address" value={info.bankAddress} />}
        {info.accountType && <Row label="Account Type" value={info.accountType} />}
        {info.swift && <Row label="Swift / BIC" value={info.swift} />}
        {info.bankCode && <Row label="Bank Code" value={info.bankCode} />}
        {info.branchNumber && <Row label="Branch Number" value={info.branchNumber} />}
        {info.binanceId && <Row label="Binance ID" value={info.binanceId} />}
        {info.walletAddress && <Row label="Wallet Address" value={info.walletAddress} />}
        {info.network && <Row label="Network" value={info.network} />}
        <Row label="Currency" value={info.currency} />
      </div>
    </div>
  );
};

export default BankInformation;
