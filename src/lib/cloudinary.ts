export const cloudinaryConfig = {
  cloudName: "djyny0qqn",
  apiKey: "153466438364967",
  apiSecret: "R81m0-w-Yvu8ABYcjKDZcYwA6N4",
  uploadPreset: "smart_cleaners_admin"
};

export const uploadImageToCloudinary = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'pdf_ocr_preset'); // Use your existing unsigned preset

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Cloudinary error response:', errorData);
      throw new Error(`Failed to upload image: ${response.status}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};