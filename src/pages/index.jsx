import React, { useState } from "react";
import Seo from "../components/Essential/Seo";
import Hero from "@/components/Home/Hero";
import Problem from "@/components/Home/Problem";
import Popupform from "@/components/Form/Popupform";
import Navbar from "@/components/Essential/Navbar";
import Footer from "@/components/Essential/Footer";
import NightScene from "@/components/Home/NightScene";
import TheTurn from "@/components/Home/TheTurn";
import Pricing from "@/components/Home/Pricing";
import Compare from "@/components/Home/Compare";
import NotFor from "@/components/Home/NotFor";
import Trust from "@/components/Home/Trust";
import Offer from "@/components/Home/Offer";
import Faq from "@/components/Home/Faq";
import CTA from "@/components/Home/Cta";

export default function Home() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <>
      <Seo />

      <Navbar onOpenPopup={() => setIsPopupOpen(true)} />

      <main id="main" className="relative">
        <Hero onOpenPopup={() => setIsPopupOpen(true)} />
        <NightScene />
        <TheTurn />
        <Problem />
        <Pricing />
        <Compare />
        <NotFor />
        <Trust />
        <Offer onOpenPopup={() => setIsPopupOpen(true)} />
        <Faq />
        <CTA />
      </main>

      <Footer />

      {/* Popup Modal */}
      <Popupform isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} />
    </>
  );
}
