import React from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import draAndreaImg from "figma:asset/560131cc7069477243e68f847aec23c23099315a.png";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-stone-50" id="#">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-xl relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3" />
            <span>Medicina Funcional & Hábitos</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-serif text-stone-900 leading-[1.15] mb-6">
            Equilibrio vital <br />
            <span className="italic text-stone-500 font-light">para la mujer imparable.</span>
          </h1>
          <p className="text-lg text-stone-600 leading-relaxed mb-10">
            Descubre un enfoque médico integral que combina el poder de la nutrición celular, 
            la suplementación estratégica y los buenos hábitos para potenciar tu vida personal, familiar y empresarial.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#booking"
              className="inline-flex items-center justify-center px-8 py-4 bg-emerald-900 text-stone-50 font-medium tracking-wide uppercase text-sm hover:bg-emerald-800 transition-all group"
            >
              Comienza tu transformación
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-stone-300 text-stone-700 font-medium tracking-wide uppercase text-sm hover:bg-stone-100 transition-colors"
            >
              Conoce mi historia
            </a>
          </div>
        </motion.div>

        {/* Image Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative h-[600px] lg:h-[700px] w-full bg-stone-200 overflow-hidden group rounded-t-full rounded-b-sm shadow-xl"
        >
          <img
            src={draAndreaImg}
            alt="Doctora Andrea, especialista en hábitos y vitaminas"
            className="w-full h-full object-cover object-top transition-transform duration-1000 group-hover:scale-105"
          />
          {/* Decorative Overlay Badge */}
          <div className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-md p-6 shadow-lg hidden sm:block">
            <p className="text-3xl font-serif text-emerald-900 mb-1">10+</p>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-medium">Años transformando vidas</p>
          </div>
        </motion.div>
      </div>
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -z-10 w-1/3 h-full bg-stone-100 mix-blend-multiply" />
    </section>
  );
}
