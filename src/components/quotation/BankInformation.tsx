import React from 'react';
import Image from 'next/image';

type BankType = 'WISE' | 'PAYONEER' | 'BINANCE';

interface BankInformationProps {
  bank: BankType;
}

interface BankDetails {
  name: string;
  logo?: string;
  accountName: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  swiftCode?: string;
  ribNumber?: string;
  address?: string;
  currency: string;
  routing?: string;
  accountType?: string;
}

const bankInformation: Record<BankType, BankDetails> = {
  WISE: {
    name: "Wise Bank",
    logo: "/images/banks/wise1.svg",
    accountName: "SOURCING LAUNCH LTD",
    iban: "BE24 9052 0546 8538",
    swift: "TRWIBEB1XXX",
    address: "Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium",
    currency: "EUR"
  },
  PAYONEER: {
    name: "Citibank (Payoneer)",
    logo: "/images/banks/payoneer.svg",
    accountName: "SOURCING LAUNCH LTD",
    accountNumber: "70583160001753419",
    accountType: "CHECKING",
    routing: "031100209",
    swiftCode: "CITIUS33",
    address: "111 Wall Street New York, NY 10043 USA",
    currency: "USD"
  },
  BINANCE: {
    name: "Binance Wallet",
    logo: "/images/banks/Binance_Logo.svg.png",
    accountName: "Binance Wallet",
    accountNumber: "0x236f536f5d68184073057259b1a4da495a28e8a8",
    address: "Network: BNB Smart Chain (BEP20)",
    currency: "USDT"
  }
};

const BankInformation: React.FC<BankInformationProps> = ({ bank }) => {
  const info = bankInformation[bank];

  const handleCopy = (info: BankDetails) => {
    // Create a nicely formatted string with all relevant bank details
    let textToCopy = `${info.name}\n`;
    textToCopy += `Name: ${info.accountName}\n`;
    
    if (info.accountNumber) {
      textToCopy += `Account Number: ${info.accountNumber}\n`;
    }
    
    if (info.accountType) {
      textToCopy += `Account Type: ${info.accountType}\n`;
    }
    
    if (info.routing) {
      textToCopy += `Routing (ABA): ${info.routing}\n`;
    }
    
    if (info.iban) {
      textToCopy += `IBAN: ${info.iban}\n`;
    }
    
    if (info.ribNumber) {
      textToCopy += `RIB Number: ${info.ribNumber}\n`;
    }
    
    if (info.swift || info.swiftCode) {
      textToCopy += `Code SWIFT: ${info.swift || info.swiftCode}\n`;
    }
    
    if (info.address) {
      textToCopy += `Address: ${info.address}\n`;
    }
    
    textToCopy += `Currency: ${info.currency}`;
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        // Could add a toast notification here
        console.log('Copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  return (
    <div className="p-6 border border-gray-200 rounded-lg bg-white mt-3">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {info.logo ? (
            <Image src={info.logo} alt={info.name} width={24} height={24} />
          ) : (
            <span className="text-lg font-medium text-blue-600">🏦</span>
          )}
          <h3 className="text-lg font-medium text-gray-900">{info.name}</h3>
        </div>
        <button 
          onClick={() => handleCopy(info)}
          className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>

      {/* Bank details area (removed scrollbar) */}
      <div className="pr-1">
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-gray-700">Name:</span>
            <span className="block text-sm font-medium text-gray-900 mt-1">{info.accountName}</span>
          </div>

          {info.accountNumber && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Account Number:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.accountNumber}</span>
            </div>
          )}

          {info.accountType && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Account Type:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.accountType}</span>
            </div>
          )}

          {info.routing && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Routing (ABA):</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.routing}</span>
            </div>
          )}

          {info.iban && (
            <div>
              <span className="block text-sm font-medium text-gray-700">IBAN:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.iban}</span>
            </div>
          )}

          {info.ribNumber && (
            <div>
              <span className="block text-sm font-medium text-gray-700">RIB Number:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.ribNumber}</span>
            </div>
          )}

          {(info.swift || info.swiftCode) && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Code SWIFT:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.swift || info.swiftCode}</span>
            </div>
          )}

          {info.address && (
            <div>
              <span className="block text-sm font-medium text-gray-700">Address:</span>
              <span className="block text-sm font-medium text-gray-900 mt-1">{info.address}</span>
            </div>
          )}

          <div>
            <span className="block text-sm font-medium text-gray-700">Currency:</span>
            <span className="block text-sm font-medium text-gray-900 mt-1">{info.currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankInformation; 