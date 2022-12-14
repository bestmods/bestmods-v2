
import { useFormik, FormikProvider, Field } from "formik";
import React, { useState, useEffect } from "react";

import { trpc } from "../../../utils/trpc";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const SourceForm: React.FC<{preUrl: string | null}> = ({ preUrl }) => {
    const [icon, setIcon] = useState<File | null>(null);
    const [banner, setBanner] = useState<File | null>(null);

    // For editing (prefilled fields).
    let name = "";
    let url = "";
    let classes = "";

    let iconData: string | ArrayBuffer | null = null;
    let bannerData: string | ArrayBuffer | null = null;

    const sourceMut = trpc.source.addSource.useMutation();

    useEffect(() => {
        // Check if we have an error.
        if (sourceMut.isError) {
            let errMsg = "";

            // Check if we can simplify the error message for client.
            if (sourceMut.error.message.includes("Error parsing URL"))
                errMsg = "Source URL is too short or empty (<2 bytes).";
            else if (sourceMut.error.message.includes("file extension is unknown"))
                errMsg = sourceMut.error.message;
            else if (sourceMut.error.message.includes("base64 data is null"))
                errMsg = "Icon or banner file(s) corrupt/invalid.";
             else
                errMsg = "Unable to create or edit source!"; 

            // Send alert and log full error to client's console.
            console.error(sourceMut.error);
            alert("Error! " + errMsg);
        }
    }, [sourceMut.isError]);

    // If we have a pre URL, that must mean we're editing. Therefore, pull existing source data.
    if (preUrl != null) {
        // Retrieve source.
        const sourceQuery = trpc.source.getSource.useQuery({url: preUrl});
        const source = sourceQuery.data;

        // Check if our source is null.
        if (source != null) {
            name = source.name;
            url = source.url;

            // Classes is optional; Check if null.
            if (source.classes != null)
                classes = source.classes;
        }
    }

    // Create form using Formik.
    const form = useFormik({
        initialValues: {
            name: name,
            url: url,
            classes: classes,
            iremove: false,
            bremove: false
        },
        enableReinitialize: true,

        onSubmit: (values) => {
            // First, handle file uploads via a promise. Not sure of any other way to do it at the moment (though I am new to TypeScript, Next.JS, and React).
            new Promise<void>(async (resolve, reject) => {
                // We have uploads / total uploads.
                let uploads: number = 0;
                let totalUploads: number = 0;
                
                // Check icon and handle upload.
                if (icon != null) {
                    // Increase our total uploads count.
                    totalUploads++;
        
                    // Create new reader.
                    const reader = new FileReader();
        
                    // On file uploaded.
                    reader.onload = () => {
                        console.debug("Icon uploaded!");
        
                        // Set Base64 data to iconData.
                        iconData = reader.result;
        
                        console.debug("Icon data => " + iconData);
        
                        // We're done; Increment uploads.
                        uploads++;
                    };
        
                    // Read icon file.
                    reader.readAsDataURL(icon);
                }
        
                // Check banner and handle upload.
                if (banner != null) {
                    // Increase our total uploads count.
                    totalUploads++;
        
                    // Create new reader.
                    const reader = new FileReader();
        
                    // On file uploaded.
                    reader.onload = () => {
                        console.debug("Banner uploaded!");
        
                        // Set Base64 data to bannerData.
                        bannerData = reader.result;
        
                        console.debug("Banner data => " + bannerData);
        
                        // We're done; Increment uploads.
                        uploads++;
                    };
        
                    // Read banner file.
                    reader.readAsDataURL(banner);
                }
                
                // Create a for loop for 30 seconds to allow files to upload. We could make a while loop, but I'd prefer having a 30 second timeout (these are image files).
                for (let i = 0; i < 30; i++) {
                    // If we're done, break to get to resolve().
                    if (uploads >= totalUploads) {
                        break;
                    }
                    
                    console.debug("Upload progress => " + uploads + "/" + totalUploads);

                    // Wait 1 second to save CPU cycles.
                    await delay(1000);
                }
        
                // We're done uploading files.
                resolve();
            }).then(() => {
                console.debug("File uploads handled!");

                // Insert into the database via mutation.
                sourceMut.mutate({
                    name: values.name,
                    url: values.url,
                    classes: values.classes,
                    icon: iconData?.toString() ?? null,
                    banner: bannerData?.toString() ?? null,
                    iremove: values.iremove,
                    bremove: values.bremove
                });
            });
        }
    });

    return (
        <>
            <FormikProvider value={form}>
                <form method="POST" onSubmit={form.handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-200 text-sm font-bold mb-2">Image</label>
                        <input className="shadow appearance-none border-blue-900 rounded w-full py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="image" name="image" type="file" placeholder="Source Image" onChange={(e) => {
                            setIcon(e.currentTarget.files[0]);
                        }} />

                        <Field className="inline align-middle border-blue-900 rounded py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="image-remove" name="iremove" type="checkbox" /> <label className="inline align-middle text-gray-200 text-sm font-bold mb-2">Remove Current</label>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-200 text-sm font-bold mb-2">Image Banner</label>
                        <input className="shadow appearance-none border-blue-900 rounded w-full py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="image_banner" name="image_banner" type="file" placeholder="Source Image Banner" onChange={(e) => {
                            setBanner(e.currentTarget.files[0]);
                        }} />

                        <input className="inline align-middle border-blue-900 rounded py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="bremove" name="image_banner-remove" type="checkbox" /> <label className="inline align-middle text-gray-200 text-sm font-bold mb-2">Remove Current</label>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-200 text-sm font-bold mb-2">Name</label>
                        <Field className="shadow appearance-none border-blue-900 rounded w-full py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="name" name="name" type="text" placeholder="Source Name" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-200 text-sm font-bold mb-2">URL</label>
                        <Field className="shadow appearance-none border-blue-900 rounded w-full py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="url" name="url" type="text" placeholder="moddingcommunity.com" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-200 text-sm font-bold mb-2">Classes</label>
                        <Field className="shadow appearance-none border-blue-900 rounded w-full py-2 px-3 text-gray-200 bg-gray-800 leading-tight focus:outline-none focus:shadow-outline" id="classes" name="classes" type="text" placeholder="CSS Classes" />
                    </div>

                    <button type="submit" className="text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 mt-2">{preUrl == null ? "Add!" : "Edit!"}</button>
                </form>
            </FormikProvider>
        </>
    );
};

export default SourceForm;