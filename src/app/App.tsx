import React from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Services } from "./components/Services";
import { Booking } from "./components/Booking";
import { ChatWidget } from "./components/ChatWidget";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="font-sans text-stone-900 bg-stone-50 min-h-screen selection:bg-emerald-900 selection:text-white scroll-smooth">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Booking />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
