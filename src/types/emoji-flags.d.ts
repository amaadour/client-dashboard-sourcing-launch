declare module 'country-flag-icons' {
  // Common interface for flag components
  interface FlagModule {
    [countryCode: string]: React.FC<React.SVGProps<SVGSVGElement>>;
  }

  // Declare the 3x1 flag aspect ratio exports
  export const Flags3x2: FlagModule;
  
  // Declare the 1x1 square flag exports
  export const FlagsSquare: FlagModule;
  
  // Declare the 4x3 flag aspect ratio exports
  export const Flags4x3: FlagModule;
  
  // Function to get country name from code
  export function getCountryData(countryCode: string): {
    name: string;
    native: string;
    phone: string;
    continent: string;
    capital: string;
    currency: string;
    languages: string[];
  } | undefined;
  
  // Country codes helper
  export const countries: string[];
} 