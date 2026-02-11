"use client";
import React from "react";
import { useForm, ValidationError } from "@formspree/react";
import Iridescence from "@/animations/Iridescence";
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const ContactForm: React.FC = () => {
  const [state, handleSubmit] = useForm("mzdadzpg");
  const containerRef = useRef(null);

  // if (state.succeeded) {
  //   return (
  //     <section className="border w-full min-h-screen flex items-center justify-center">
  //       <div className="max-w-7xl mx-auto flex items-center justify-center px-4 lg:px-0 py-20">
  //         <div className="w-full max-w-2xl">
  //           <div className="relative w-full h-auto min-h-96 flex items-center justify-center">
  //             <div className="z-0 absolute inset-0 overflow-hidden rounded-2xl lg:rounded-3xl flex items-center justify-center">
  //               {/* Animated BG */}
  //               <Iridescence
  //                 color={[0, 0.8, 1]}
  //                 mouseReact
  //                 amplitude={0.1}
  //                 speed={1}
  //               />

  //               {/* Blur Glass */}
  //               <div className="z-2 absolute inset-0 backdrop-blur-[5px]"></div>

  //               {/* Content */}
  //               <div className="z-3 relative text-center flex flex-col items-center justify-center gap-4">
  //                 <h2 className="font-normal text-2xl lg:text-4xl text-black">
  //                   Thank you!
  //                 </h2>
  //                 <p className="font-normal text-base lg:text-lg text-zinc-600 max-w-md">
  //                   We&apos;ve received your message and will get back to you.
  //                   soon.
  //                 </p>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     </section>
  //   );
  // }

  return (
    <>
      {state.submitting ? (
        <div className="relative animate-pulse w-full h-[calc(100vh-72px)] lg:h-[calc(100vh-104px)] min-h-70 bg-main-bg rounded-xl flex items-center justify-center gap-4 overflow-hidden">
          <h3 className="z-1 font-semibold lg:font-normal text-center lg:text-left text-2xl lg:text-5xl text-balance text-transparent bg-linear-to-r bg-clip-text from-blue-400 to-zinc-400">
            Sending Message...
          </h3>
          <Image
            src="./hero/FlowtingLogoBlue.svg"
            alt="Flowting Logo"
            width={16}
            height={16}
            className="z-0 absolute w-40 h-40 lg:w-120 lg:h-120 object-contain opacity-10"
          />
        </div>
      ) : state.succeeded ? (
        <div className="relative w-full h-[calc(100vh-72px)] lg:h-[calc(100vh-104px)] min-h-70 bg-main-bg rounded-xl flex items-center justify-center gap-4 overflow-hidden">
          <h3 className="z-1 font-semibold lg:font-normal text-center lg:text-left text-2xl lg:text-5xl text-balance text-transparent bg-linear-to-r bg-clip-text from-blue-600 to-zinc-400">
            Thank you for reaching out to us.
            <br />
            We will contact you soon.
          </h3>
          <Image
            src="./hero/FlowtingLogoBlue.svg"
            alt="Flowting Logo"
            width={16}
            height={16}
            className="z-0 absolute w-40 h-40 lg:w-120 lg:h-120 object-contain opacity-10"
          />
        </div>
      ) : (
        <section className="w-full min-h-screen flex items-center justify-center bg-main-bg">
          <div className="max-w-7xl mx-auto flex items-center justify-center px-2 lg:px-0 py-12 lg:py-20 w-full">
            <div className="w-full max-w-2xl">
              <div className="relative w-full h-auto flex items-center justify-center px-2 py-2 sm px-10sm:py-10 lg:py-20">
                {/* Animated BG */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl lg:rounded-3xl">
                  <Iridescence
                    color={[0, 0.8, 1]}
                    mouseReact
                    amplitude={0.1}
                    speed={1}
                  />
                </div>

                {/* Blur Glass */}
                <div className="absolute inset-0 backdrop-blur-[5px] rounded-2xl lg:rounded-3xl -z-10"></div>

                {/* Form Container */}
                <div
                  ref={containerRef}
                  className="relative w-full max-w-xl bg-white/95 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-12 shadow-2xl z-10"
                >
                  {/* Header */}
                  <div className="flex flex-col gap-2 mb-8">
                    <h2 className="font-normal text-2xl lg:text-3xl text-black">
                      Get In Touch
                    </h2>
                    <p className="font-normal text-sm lg:text-base text-zinc-600">
                      Have a question or want to work with us? We&apos;d love to
                      hear from you.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Row 1: First & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="firstName"
                          className="font-medium text-sm text-black"
                        >
                          First Name
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          name="firstName"
                          required
                          className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="John"
                        />
                        <ValidationError
                          prefix="First Name"
                          field="firstName"
                          errors={state.errors}
                          className="text-red-500 text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="lastName"
                          className="font-medium text-sm text-black"
                        >
                          Last Name
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          name="lastName"
                          required
                          className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Doe"
                        />
                        <ValidationError
                          prefix="Last Name"
                          field="lastName"
                          errors={state.errors}
                          className="text-red-500 text-xs"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="email"
                        className="font-medium text-sm text-black"
                      >
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        required
                        className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="john@example.com"
                      />
                      <ValidationError
                        prefix="Email"
                        field="email"
                        errors={state.errors}
                        className="text-red-500 text-xs"
                      />
                    </div>

                    {/* Message */}
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="message"
                        className="font-medium text-sm text-black"
                      >
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        required
                        className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        placeholder="Tell us more about your inquiry..."
                      />
                      <ValidationError
                        prefix="Message"
                        field="message"
                        errors={state.errors}
                        className="text-red-500 text-xs"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={state.submitting}
                      className="cursor-pointer w-full mt-4 px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                    >
                      {state.submitting ? "Sending..." : "Connect With Us"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default ContactForm;
