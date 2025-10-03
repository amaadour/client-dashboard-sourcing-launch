import React, { useState } from 'react';
import Image from 'next/image';
import { CopyIcon } from '@/icons'; // Assuming you have a CopyIcon component
import { toast } from 'sonner';

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard!`);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    toast.error('Failed to copy');
  });
};

const BankDetail = ({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) => (
  <div className="flex justify-between items-start text-sm mb-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
    <span className="text-gray-600 dark:text-gray-400 w-1/3 flex-shrink-0">{label}:</span>
    <div className="flex items-center gap-2 w-2/3 justify-end text-right">
      <span className="font-medium text-gray-800 dark:text-white/90 break-words">{value}</span>
      {copyable && value && (
        <button 
          onClick={() => copyToClipboard(value, label)}
          className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors flex-shrink-0 ml-1"
          aria-label={`Copy ${label}`}
        >
          <CopyIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);

interface AccordionItemProps {
  title: string;
  iconSrc: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, iconSrc, children, isOpen, onClick }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-3 last:mb-0 transition-all duration-300 bg-white dark:bg-gray-800/50 shadow-sm hover:shadow-md">
    <button
      className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
      onClick={onClick}
      aria-expanded={isOpen}
    >
      <div className="flex items-center gap-3">
        <Image src={iconSrc} alt={title} width={32} height={32} className="rounded" />
        <span className="text-lg font-semibold text-gray-800 dark:text-white">{title}</span>
      </div>
      <svg
        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
    >
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
        {children}
      </div>
    </div>
  </div>
);

const PaymentMethodsDisplay: React.FC = () => {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenAccordion(openAccordion === id ? null : id);
  };

  return (
    <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Available Payment Methods</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-6">Click on a method below to view details. Use one of these accounts to complete your payment and upload the proof afterward.</p>
      
      <div>
        {/* CIH Bank Accordion */}
        <AccordionItem
          title="CIH Bank"
          iconSrc="/images/bank/cih.png"
          isOpen={openAccordion === 'cih'}
          onClick={() => toggleAccordion('cih')}
        >
          <BankDetail label="Account Holder" value="MEHDI AMAADOUR" />
          <BankDetail label="Agency" value="BOUSKOURA VILLE VERTE" />
          <BankDetail label="Address" value="PROJET BOUSKOURA GOLF CITY- IMM.EP 9-CENTRE COMMERCIAL-MAGASIN 7 BOUSKOURA" />
          <BankDetail label="Phone" value="05 22 88 81 90/93" />
          <BankDetail label="RIB" value="230 791 4171053211031201 39" copyable />
          <BankDetail label="IBAN" value="MA64 2307 9141 7105 3211 0312 0139" copyable />
          <BankDetail label="BIC/SWIFT" value="CIHMMAMC" copyable />
        </AccordionItem>

        {/* Societe Generale Accordion */}
        <AccordionItem
          title="Societe Generale Maroc"
          iconSrc="/images/bank/sg.png"
          isOpen={openAccordion === 'sg'}
          onClick={() => toggleAccordion('sg')}
        >
          <BankDetail label="Account Holder" value="AMAADOUR MEHDI" />
          <BankDetail label="SWIFT" value="SGMBMAMC" copyable />
          <BankDetail label="Agency Address" value="LOTISSEMENT ONA 154 BOULEVARD AL QODS AIN CHOCK" />
          <BankDetail label="Agency" value="AL QODS OULAD TALEB" />
          <BankDetail label="Account No." value="022 780 0003590028373727 74" copyable />
          <BankDetail label="Currency" value="MAD" />
        </AccordionItem>

        {/* Wise Accordion */}
        <AccordionItem
          title="Wise (TransferWise)"
          iconSrc="/images/bank/wise.png"
          isOpen={openAccordion === 'wise'}
          onClick={() => toggleAccordion('wise')}
        >
          <BankDetail label="Account Holder" value="Amaadour Ltd" />
          <BankDetail label="IBAN" value="BE24 9052 0546 8538" copyable />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Can receive EUR and other currencies.</p>
          <BankDetail label="SWIFT/BIC" value="TRWIBEB1XXX" copyable />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">Only used for international Swift transfers</p>
          <BankDetail label="Bank Name & Address" value="Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium" />
          <a href="https://wise.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-2 block">Learn more about Wise</a>
        </AccordionItem>

        {/* Payoneer Accordion */}
        <AccordionItem
          title="Payoneer"
          iconSrc="/images/bank/payoneer.png"
          isOpen={openAccordion === 'payoneer'}
          onClick={() => toggleAccordion('payoneer')}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Please contact support to arrange payment via Payoneer.</p>
          {/* Add Payoneer details if available, or a contact link */}
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm">Contact Support</button>
        </AccordionItem>
      </div>
    </div>
  );
};

export default PaymentMethodsDisplay; 