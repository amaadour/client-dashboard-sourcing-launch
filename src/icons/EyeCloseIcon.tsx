import React from 'react';

interface EyeCloseIconProps {
  className?: string;
}

const EyeCloseIcon: React.FC<EyeCloseIconProps> = ({ className }) => {
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
        d="M2.5 2.5L17.5 17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.8333 8.8331C8.47968 9.18672 8.28076 9.66664 8.28076 10.1665C8.28076 11.0869 9.0271 11.8331 9.94731 11.8331C10.4471 11.8331 10.9271 11.6344 11.2809 11.2806"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.7666 6.7168C10.5111 6.69093 10.2555 6.67676 9.9999 6.67676C7.8388 6.67676 5.31758 7.71546 3.28047 10.8419C3.95325 12.0085 4.68991 12.8919 5.47491 13.5002"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.925 12.9504C12.2522 13.4893 11.4894 13.8337 10 13.8337C7.83891 13.8337 5.31769 12.795 3.28058 9.66846C4.23336 7.97068 5.42502 6.80401 6.7528 6.13901"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.7138 8.71973C11.0674 9.07334 11.2663 9.55325 11.2663 10.0531C11.2663 10.9733 10.5199 11.7195 9.5997 11.7195C9.09985 11.7195 8.61993 11.5206 8.26633 11.167"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.4446 11.9332C15.1113 11.3915 15.7335 10.6776 16.3002 9.7776C14.2629 6.65108 11.7417 5.61237 9.58057 5.61237C9.38502 5.61237 9.19502 5.62375 9.01113 5.64236"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default EyeCloseIcon; 