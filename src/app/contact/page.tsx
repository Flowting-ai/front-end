import ContactForm from "@/components/Contact/ContactForm";
import Navbar from "@/components/Navbar/Navbar";

export default function ContactPage() {
  return (
    <>
      {/* === NAVBAR === */}
      <div className="max-w-7xl mx-auto bg-main-bg flex items-center justify-center px-2 lg:px-0 py-3 lg:py-6">
        <Navbar />
      </div>

      {/* === CONTACT FORM === */}
      <ContactForm />
    </>
  );
}
