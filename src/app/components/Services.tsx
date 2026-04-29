import React from "react";
import { motion } from "motion/react";
import { Check, Pill, Stethoscope, Sun } from "lucide-react";

export function Services() {
  const services = [
    {
      title: "Medicina Preventiva & Funcional",
      icon: <Stethoscope className="w-8 h-8" />,
      description: "Consultas presenciales o virtuales para un análisis completo de salud, metabolismo y estilo de vida.",
      benefits: ["Evaluación clínica detallada", "Exámenes de laboratorio específicos", "Plan de acción a tu medida"]
    },
    {
      title: "Planificación con Vitaminas",
      icon: <Pill className="w-8 h-8" />,
      description: "Los suplementos adecuados marcan la diferencia. Te ayudo a saber exactamente qué vitaminas necesita tu cuerpo para rendir mejor.",
      benefits: ["Optimización de energía", "Refuerzo del sistema inmune", "Antienvejecimiento celular"]
    },
    {
      title: "Coaching de Hábitos",
      icon: <Sun className="w-8 h-8" />,
      description: "Construyamos una rutina que se adapte a tu agitada vida como madre, profesional o empresaria sin abrumarte.",
      benefits: ["Manejo de estrés", "Rutinas matutinas sostenibles", "Equilibrio entre familia y negocio"]
    }
  ];

  return (
    <section id="philosophy" className="py-24 bg-stone-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-emerald-800 font-medium tracking-widest text-sm uppercase mb-3">
            Mi Enfoque
          </p>
          <h2 className="text-4xl lg:text-5xl font-serif text-stone-900 leading-tight mb-6">
            Soluciones integrales para la mujer exigente
          </h2>
          <p className="text-stone-600">
            A través de tres pilares fundamentales, diseño estrategias que funcionan en el mundo real, no solo en la teoría médica.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="bg-white p-10 shadow-sm border border-stone-100 hover:shadow-xl transition-shadow duration-300 rounded-sm group relative overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-800/0 group-hover:bg-emerald-800 transition-colors duration-300" />
              
              <div className="mb-6 inline-flex p-4 rounded-full bg-stone-50 text-emerald-900 group-hover:bg-emerald-50 transition-colors duration-300">
                {service.icon}
              </div>
              <h3 className="text-2xl font-serif text-stone-900 mb-4">{service.title}</h3>
              <p className="text-stone-600 mb-8 text-sm leading-relaxed">
                {service.description}
              </p>
              
              <ul className="space-y-3">
                {service.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-emerald-800 mt-1 shrink-0" />
                    <span className="text-stone-700 text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
