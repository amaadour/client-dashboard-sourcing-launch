import React from 'react';

interface EyeIconProps {
  className?: string;
}

const EyeIcon: React.FC<EyeIconProps> = ({ className }) => {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.28033 10C5.31744 13.1265 7.83833 14.1652 10 14.1652C12.1617 14.1652 14.6825 13.1265 16.7197 10C14.6825 6.87354 12.1617 5.83484 10 5.83484C7.83833 5.83484 5.31744 6.87354 3.28033 10Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 13.3333C11.8409 13.3333 13.3333 11.8409 13.3333 10C13.3333 8.15905 11.8409 6.66667 10 6.66667C8.15905 6.66667 6.66667 8.15905 6.66667 10C6.66667 11.8409 8.15905 13.3333 10 13.3333ZM10 11.6667C10.9205 11.6667 11.6667 10.9205 11.6667 10C11.6667 9.07953 10.9205 8.33333 10 8.33333C9.07953 8.33333 8.33333 9.07953 8.33333 10C8.33333 10.9205 9.07953 11.6667 10 11.6667Z"
        fill="white"
      />
    </svg>
  );
};

export default EyeIcon; 