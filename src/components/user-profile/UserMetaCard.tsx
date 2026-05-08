"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

// Define the profile data type
type ProfileData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  updated_at?: string;
};

// Initialize localStorage if available (client-side only)
const getInitialProfileData = (): ProfileData => {
  if (typeof window !== 'undefined') {
    try {
      const storedData = localStorage.getItem('profileData');
      if (storedData) {
        return JSON.parse(storedData);
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
    }
  }
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  };
};

export default function UserMetaCard() {
  // Initialize with data from localStorage immediately if available
  const [profileData, setProfileData] = useState<ProfileData>(getInitialProfileData);
  const [profileImage, setProfileImage] = useState<string | null>(
    typeof window !== 'undefined' 
      ? getInitialProfileData().avatar_url || null 
      : null
  );
  
  const { isOpen, openModal, closeModal } = useModal();
  const { user } = useAuth();
  
  // Sync with Auth data if no localStorage data exists
  useEffect(() => {
    if (!profileData.first_name && !profileData.last_name && user) {
      const initialData = {
        first_name: user.user_metadata?.first_name || "",
        last_name: user.user_metadata?.last_name || "",
        email: user.email || "",
        phone: user.user_metadata?.phone || "",
        avatar_url: user.user_metadata?.avatar_url || null,
        updated_at: new Date().toISOString(),
      };
      setProfileData(initialData);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('profileData', JSON.stringify(initialData));
      }
      
      if (initialData.avatar_url) {
        setProfileImage(initialData.avatar_url);
      }
    }
  }, [user, profileData.first_name, profileData.last_name]);
  
  // Get user's profile data
  const firstName = profileData.first_name;
  const lastName = profileData.last_name;
  const email = profileData.email;
  const phone = profileData.phone;
  
  // Get initials for the profile circle if no image
  const getInitials = () => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    
    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    } else if (firstInitial) {
      return firstInitial;
    } else if (email) {
      return email.charAt(0).toUpperCase();
    } else {
      return "U";
    }
  };
  
  // Generate a background color based on the user's name
  const getProfileColor = () => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-purple-500", 
      "bg-red-500", "bg-yellow-500", "bg-indigo-500",
      "bg-pink-500", "bg-teal-500"
    ];
    
    // Simple hash function for consistent color
    const fullName = `${firstName} ${lastName}`;
    const hash = (fullName.length + email.length) % colors.length;
    return colors[hash];
  };
  
  // Format WhatsApp number for link
  const getWhatsAppLink = () => {
    if (!phone) return "#";
    // Remove any non-digit characters
    const cleanNumber = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}`;
  };

  // Update profile data and save to localStorage
  const saveProfileData = (updatedData: ProfileData) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('profileData', JSON.stringify(updatedData));
    }
    setProfileData(updatedData);
  };

  const handleSave = () => {
    // Get form data
    const form = document.querySelector('form') as HTMLFormElement;
    if (!form) return;
    
    const formData = new FormData(form);
    const updatedData = {
      ...profileData,
      first_name: formData.get('firstName') as string || profileData.first_name,
      last_name: formData.get('lastName') as string || profileData.last_name,
      phone: formData.get('phone') as string || profileData.phone,
      updated_at: new Date().toISOString(),
    };
    
    // If there's a new profile image
    if (profileImage && profileImage !== profileData.avatar_url) {
      updatedData.avatar_url = profileImage;
    }
    
    // Save data
    saveProfileData(updatedData);
    console.log("Profile updated:", updatedData);
    closeModal();
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileImage(result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Format the updated date
  const formatUpdatedDate = () => {
    if (!profileData.updated_at) return "";
    
    try {
      const date = new Date(profileData.updated_at);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return "";
    }
  };
  
  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800 flex items-center justify-center">
              {profileImage || profileData.avatar_url ? (
                <Image
                  width={80}
                  height={80}
                  src={profileImage || profileData.avatar_url || ""}
                  alt={`${firstName} ${lastName}`}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className={`w-full h-full ${getProfileColor()} flex items-center justify-center text-xl text-white font-medium`}>
                  {getInitials()}
                </div>
              )}
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {firstName && lastName ? `${firstName} ${lastName}` : "User Profile"}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {email}
                </p>
              </div>
              {profileData.updated_at && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Last updated: {formatUpdatedDate()}
                </p>
              )}
            </div>
            <div className="flex items-center order-2 gap-2 grow xl:order-3 xl:justify-end">
              {/* WhatsApp Button */}
              {phone && (
                <a 
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer" 
                  className="flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
                >
                  <svg 
                    className="fill-current" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 20 20" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M10.0025 0H9.9975C4.48375 0 0 4.485 0 10C0 12.1875 0.705 14.215 1.90375 15.8612L0.6575 19.5763L4.50125 18.3475C6.0825 19.395 7.96875 20 10.0025 20C15.5162 20 20 15.5138 20 10C20 4.48625 15.5162 0 10.0025 0Z" 
                      fill="#4CAF50" 
                    />
                    <path 
                      d="M15.8212 14.1212C15.5799 14.8025 14.6224 15.3675 13.8587 15.5325C13.3362 15.6437 12.6537 15.7325 10.3562 14.78C7.41744 13.5625 5.52494 10.5762 5.37744 10.3825C5.23619 10.1887 4.18994 8.80123 4.18994 7.36623C4.18994 5.93123 4.91869 5.23248 5.21244 4.93248C5.45369 4.68623 5.85244 4.57373 6.23494 4.57373C6.35869 4.57373 6.46994 4.57998 6.56994 4.58498C6.86369 4.59748 7.01119 4.61498 7.20494 5.07873C7.44619 5.65998 8.03369 7.09498 8.10369 7.24248C8.17494 7.38998 8.24619 7.58998 8.14619 7.78373C8.05244 7.98373 7.96994 8.07248 7.82244 8.24248C7.67494 8.41248 7.53494 8.54248 7.38744 8.72498C7.25369 8.88373 7.09994 9.05373 7.26994 9.34748C7.43994 9.63498 8.02744 10.5937 8.89244 11.3637C10.0087 12.3575 10.9137 12.675 11.2374 12.8087C11.4787 12.9075 11.7662 12.8875 11.9424 12.6987C12.1662 12.4575 12.4424 12.0575 12.7237 11.6637C12.9237 11.3812 13.1762 11.3462 13.4412 11.4462C13.7112 11.54 15.1399 12.2462 15.4337 12.3925C15.7274 12.54 15.9212 12.61 15.9924 12.7337C16.0624 12.8575 16.0624 13.4387 15.8212 14.1212Z" 
                      fill="white" 
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
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
            Edit
          </button>
        </div>
      </div>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit Personal Information
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Update your details to keep your profile up-to-date.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              {/* Profile Image Section */}
              <div className="mb-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">
                  Profile Image
                </h5>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800 flex items-center justify-center">
                    {profileImage ? (
                      <Image
                        width={80}
                        height={80}
                        src={profileImage}
                        alt="Profile Preview"
                        className="object-cover w-full h-full"
                      />
                    ) : profileData.avatar_url ? (
                      <Image
                        width={80}
                        height={80}
                        src={profileData.avatar_url}
                        alt="Profile"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className={`w-full h-full ${getProfileColor()} flex items-center justify-center text-xl text-white font-medium`}>
                        {getInitials()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label>Upload Profile Picture</Label>
                    <Input
                      type="file"
                      onChange={handleImageChange}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Recommended: Square image, at least 200x200 pixels
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Personal Information Section */}
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>First Name</Label>
                    <Input 
                      type="text" 
                      name="firstName"
                      defaultValue={firstName} 
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Last Name</Label>
                    <Input 
                      type="text" 
                      name="lastName"
                      defaultValue={lastName} 
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Email Address</Label>
                    <Input 
                      type="email" 
                      name="email"
                      defaultValue={email} 
                      disabled 
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Email cannot be changed as it&apos;s used for authentication
                    </p>
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Phone (WhatsApp)</Label>
                    <Input 
                      type="tel" 
                      name="phone"
                      defaultValue={phone} 
                      placeholder="+1234567890"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
