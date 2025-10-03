"use client";
import { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; // Import Supabase client
import { customToast } from "@/components/ui/toast"; // Use the customToast utility

// Define the profile data type
type ProfileData = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  country?: string;
  address?: string;
  city?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

// No longer needed as we fetch directly
// const getInitialProfileData = (): ProfileData => { ... };

export default function UserInfoCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null); // Start with null
  const [loadingProfile, setLoadingProfile] = useState(true); // Loading state for profile fetch
  const [initialSetup, setInitialSetup] = useState(false); // Track if this is initial profile setup
  const [updateSuccess, setUpdateSuccess] = useState(false); // Track successful updates for UI feedback
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    country: ""
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    console.log(`Field ${name} changed to: ${value}`);
  };

  // Log Supabase client configuration
  useEffect(() => {
    console.log("Supabase client available:", !!supabase);
    console.log("Current authenticated user:", user);
    
    // Test Supabase permissions
    const testSupabasePermissions = async () => {
      if (!user) return;
      
      try {
        // Test read permission
        console.log("Testing Supabase read permissions...");
        const { data: readData, error: readError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
          
        console.log("Read test result:", { success: !readError, data: readData, error: readError });
        
        // Test insert permission with a dummy record (that we'll immediately delete)
        if (user.id) {
          console.log("Testing Supabase write permissions...");
          // First check if the user already has a profile
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();
            
          if (!existingProfile) {
            // Try to create a dummy profile
            const testData = {
              id: user.id,
              first_name: 'Test',
              last_name: 'User',
              full_name: 'Test User',
              email: user.email || 'test@example.com',
              updated_at: new Date().toISOString()
            };
            
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([testData]);
              
            console.log("Insert test result:", { success: !insertError, error: insertError });
          } else {
            // Try a small update
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', user.id);
              
            console.log("Update test result:", { success: !updateError, error: updateError });
          }
        }
      } catch (err) {
        console.error("Error testing Supabase permissions:", err);
      }
    };
    
    testSupabasePermissions();
  }, [user]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*') // Select all fields
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching profile data:", error);
          
          // Check if the error is because the profile doesn't exist
          if (error.code === 'PGRST116' || error.message?.includes('no rows')) {
            console.log("No profile found, creating initial profile for user:", user.id);
            
            // Extract user metadata from auth user
            const firstName = user.user_metadata?.first_name || '';
            const lastName = user.user_metadata?.last_name || '';
            const email = user.email || '';
            
            // Create a minimal profile to start
            const initialProfile: ProfileData = {
              id: user.id,
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              email: email,
              phone: '',
              country: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            setProfileData(initialProfile);
            setInitialSetup(true); // This is initial setup
            setLoadingProfile(false);
            
            // Automatically open the edit modal for new users
            setTimeout(() => {
              openModal();
            }, 500);
            
            return;
          } else {
            // Some other error occurred
            setProfileData(null);
          }
        } else if (data) {
          console.log("Profile fetched successfully:", data);
          
          // Update form data with profile data
          setFormData({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            phone: data.phone || "",
            country: data.country || ""
          });
          
          // Check if profile has minimal data and might need completion
          if (!data.first_name && !data.last_name && !data.phone && !data.country) {
            setInitialSetup(true);
            // Automatically open the edit modal for incomplete profiles
            setTimeout(() => {
              openModal();
            }, 500);
          }
          
          setProfileData(data);
        }
      } catch (err) {
        console.error("Exception fetching profile data:", err);
        setProfileData(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, [user, openModal]); // Re-fetch when user changes

  // Get profile data safely
  const firstName = profileData?.first_name || "";
  const lastName = profileData?.last_name || "";
  const email = profileData?.email || user?.email || ""; // Fallback to user email
  const phone = profileData?.phone || "";
  const country = profileData?.country;
  

  // Format WhatsApp number for link
  const getWhatsAppLink = () => {
    if (!phone) return "#";
    const cleanNumber = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}`;
  };

  // Function to update user metadata in auth
  const updateUserMetadata = async () => {
    if (!user) return;
    
    try {
      setLoadingProfile(true);
      
      // Prepare clean data with trimmed values
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      
      // Update user metadata in Supabase
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: phone || null,
          country: country || null,
          updated_at: new Date().toISOString(),
        },
      });
      
      if (error) {
        console.error("Error updating user:", error);
        throw error;
      }
      
      // Create consistent profile data object
      const updatedProfileData = {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: trimmedFirstName && trimmedLastName 
          ? `${trimmedFirstName} ${trimmedLastName}`
          : trimmedFirstName || trimmedLastName || "User",
        email: user.email,
        phone: phone || null,
        country: country || null,
        updated_at: new Date().toISOString(),
      };
      
      // Remove first to trigger storage events properly
      localStorage.removeItem('profileData');
      
      // Update localStorage
      localStorage.setItem('profileData', JSON.stringify(updatedProfileData));
      
      // Dispatch a custom event to notify components on the same page
      const event = new CustomEvent('profileDataUpdated', {
        detail: updatedProfileData
      });
      window.dispatchEvent(event);
      
      console.log("Profile updated successfully:", updatedProfileData);
      
      setLoadingProfile(false);
      setInitialSetup(false);
      customToast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      setLoadingProfile(false);
      customToast({
        variant: "destructive",
        title: "Update Failed",
        description: "There was a problem updating your profile. Please try again.",
      });
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Form submitted with state data:", formData);
    
    if (!user) {
      console.error("User missing", { user });
      return;
    }
    
    // Use the form state directly instead of trying to get values from the form elements
    const { firstName, lastName, phone, country } = formData;
    
    // Prepare data based on whether we're creating or updating
    const newData: Partial<ProfileData> = {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone: phone,
      country: country,
      updated_at: new Date().toISOString()
    };
    
    // If we have existing profile data, ensure email is preserved
    if (profileData?.email) {
      newData.email = profileData.email;
    } else if (user.email) {
      newData.email = user.email;
    }
    
    console.log(`Attempting to ${initialSetup ? 'create' : 'update'} profile with data:`, newData);
    console.log("User ID:", user.id);
    
    try {
      let result;
      
      if (initialSetup && !profileData?.id) {
        // This is a new profile creation
        console.log("Creating new profile in Supabase...");
        result = await supabase
          .from('profiles')
          .insert([{ 
            ...newData, 
            id: user.id,
            created_at: new Date().toISOString() 
          }])
          .select('*');
          
        setInitialSetup(false); // No longer initial setup
      } else {
        // This is an update to existing profile
        console.log("Updating existing profile in Supabase...");
        result = await supabase
          .from('profiles')
          .update(newData)
          .eq('id', user.id)
          .select('*');
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error("Error saving profile:", error);
        alert(`Failed to ${initialSetup ? 'create' : 'update'} profile. Please try again.`);
        return;
      }
      
      console.log("Profile saved successfully in database:", data);
      
      // Also update user metadata so it's reflected in the header
      await updateUserMetadata();
      
      // Verify the data was saved
      const { data: verificationData, error: verificationError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (verificationError) {
        console.error("Verification query failed:", verificationError);
      } else {
        console.log("VERIFICATION: Latest profile data from database:", verificationData);
      }
      
      // Update local state with the data returned from database
      if (data && data.length > 0) {
        // Close the modal first
        closeModal();
        
        // Show success message
        setUpdateSuccess(true);
        
        // Alert the user
        alert(`Profile ${initialSetup ? 'created' : 'updated'} successfully!`);
        
        // Wait 1 second, then refresh the page
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
    } catch (err) {
      console.error(`Exception ${initialSetup ? 'creating' : 'updating'} profile:`, err);
      alert("An error occurred while saving your profile.");
    }
  };

  // Format the updated date
  const formatUpdatedDate = () => {
    if (!profileData?.updated_at) return "";
    try {
      const date = new Date(profileData.updated_at);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return "";
    }
  };

  if (loadingProfile) {
    // Optional: Add a specific loading state for the card
    return (
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 animate-pulse">
        <div className="h-6 mb-3 bg-gray-200 rounded dark:bg-gray-700 w-1/3"></div>
        <div className="grid grid-cols-1 gap-y-6 md:grid-cols-2 md:gap-x-4 md:gap-y-7">
          <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
          <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
          <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
          <div className="h-10 bg-gray-200 rounded dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  if (!profileData && !loadingProfile) {
     // Handle case where profile couldn't be loaded
     return (
       <div className="p-5 border border-red-200 rounded-2xl dark:border-red-800 lg:p-6 bg-red-50 dark:bg-red-900/20">
         <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
           Error Loading Profile
         </h3>
         <p className="text-sm text-red-600 dark:text-red-300">Could not fetch user information.</p>
       </div>
     );
  }

  return (
    <>
      <div className="relative p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        {updateSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10 rounded-2xl">
            <div className="text-center p-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Updated!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your profile has been successfully updated.</p>
            </div>
          </div>
        )}
        
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {initialSetup ? "Complete Your Profile" : "User Information"}
          </h3>
          <button
            onClick={openModal}
            className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-full text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            aria-label="Edit profile"
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
                fill=""
              />
            </svg>
          </button>
        </div>
        
        {initialSetup ? (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Please complete your profile information by clicking the edit button.
            </p>
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-y-6 md:grid-cols-2 md:gap-x-4 md:gap-y-7">
            <div className="md:col-span-1">
              <span className="mb-2 block text-sm font-normal text-gray-500 dark:text-gray-400">
                Full Name
              </span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || "Not provided")}
              </span>
            </div>
            <div className="md:col-span-1">
              <span className="mb-2 block text-sm font-normal text-gray-500 dark:text-gray-400">
                Email
              </span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {email}
              </span>
            </div>
            <div className="md:col-span-1">
              <span className="mb-2 block text-sm font-normal text-gray-500 dark:text-gray-400">
                Phone (WhatsApp)
              </span>
              <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                {phone || "Not provided"}
                {phone && (
                  <a 
                    href={getWhatsAppLink()}
                    target="_blank"
                    rel="noreferrer" 
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white bg-green-500 hover:bg-green-600"
                  >
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 20 20" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M10.0025 0H9.9975C4.48375 0 0 4.485 0 10C0 12.1875 0.705 14.215 1.90375 15.8612L0.6575 19.5763L4.50125 18.3475C6.0825 19.395 7.96875 20 10.0025 20C15.5162 20 20 15.5138 20 10C20 4.48625 15.5162 0 10.0025 0Z"
                        fill="white" 
                      />
                      <path 
                        d="M15.8212 14.1212C15.5799 14.8025 14.6224 15.3675 13.8587 15.5325C13.3362 15.6437 12.6537 15.7325 10.3562 14.78C7.41744 13.5625 5.52494 10.5762 5.37744 10.3825C5.23619 10.1887 4.18994 8.80123 4.18994 7.36623C4.18994 5.93123 4.91869 5.23248 5.21244 4.93248C5.45369 4.68623 5.85244 4.57373 6.23494 4.57373C6.35869 4.57373 6.46994 4.57998 6.56994 4.58498C6.86369 4.59748 7.01119 4.61498 7.20494 5.07873C7.44619 5.65998 8.03369 7.09498 8.10369 7.24248C8.17494 7.38998 8.24619 7.58998 8.14619 7.78373C8.05244 7.98373 7.96994 8.07248 7.82244 8.24248C7.67494 8.41248 7.53494 8.54248 7.38744 8.72498C7.25369 8.88373 7.09994 9.05373 7.26994 9.34748C7.43994 9.63498 8.02744 10.5937 8.89244 11.3637C10.0087 12.3575 10.9137 12.675 11.2374 12.8087C11.4787 12.9075 11.7662 12.8875 11.9424 12.6987C12.1662 12.4575 12.4424 12.0575 12.7237 11.6637C12.9237 11.3812 13.1762 11.3462 13.4412 11.4462C13.7112 11.54 15.1399 12.2462 15.4337 12.3925C15.7274 12.54 15.9212 12.61 15.9924 12.7337C16.0624 12.8575 16.0624 13.4387 15.8212 14.1212Z"
                        fill="#4CAF50" 
                      />
                    </svg>
                  </a>
                )}
              </span>
            </div>
            {country && (
              <div className="md:col-span-1">
                <span className="mb-2 block text-sm font-normal text-gray-500 dark:text-gray-400">
                  Country
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {country}
                </span>
              </div>
            )}
           
            {profileData?.updated_at && (
              <div className="md:col-span-2">
                <span className="mb-2 block text-xs text-gray-400 dark:text-gray-500">
                  Last updated: {formatUpdatedDate()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px]">
        <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-9">
          <div className="px-2">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              {initialSetup ? "Complete Your Profile" : "Edit User Information"}
            </h4>
            <p className="mb-9 text-sm text-gray-500 dark:text-gray-400">
              {initialSetup ? "Please provide your information to complete your profile." : "Update your personal information."}
            </p>
          </div>
          <form className="w-full" onSubmit={handleSave}>
            <div className="px-2">
              <div className="mb-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">
                  Personal Details
                </h5>
                <div className="grid grid-cols-1 gap-5 gap-y-4 md:grid-cols-2">
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="John"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                      className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Doe"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Email (cannot be changed)
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      className="w-full rounded-md border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm text-gray-500 placeholder:text-sm placeholder:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:placeholder:text-gray-500"
                      value={email}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      id="country"
                      className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400"
                      value={formData.country}
                      onChange={handleInputChange}
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-2">
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
                <Button
                  variant="outline"
                  className="px-4 py-2.5 lg:px-5"
                  onClick={closeModal}
                  disabled={initialSetup}
                >
                  {initialSetup ? "Required" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  className="px-4 py-2.5 lg:px-5"
                >
                  {initialSetup ? "Complete Profile" : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
