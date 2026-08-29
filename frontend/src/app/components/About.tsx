import React from "react";
import { motion } from "motion/react";
import { Heart, Briefcase, Users, Activity } from "lucide-react";

export function About() {
  const values = [
    {
      icon: <Users className="w-5 h-5" />,
      title: "Madre",
      description: "Entiendo el reto de equilibrar una familia de dos niños con una vida profesional activa."
    },
    {
      icon: <Briefcase className="w-5 h-5" />,
      title: "Empresaria",
      description: "El rendimiento empresarial requiere claridad mental y energía que solo la salud puede dar."
    },
    {
      icon: <Heart className="w-5 h-5" />,
      title: "Médico Especialista",
      description: "Ciencia, suplementación precisa y cuidado integral como pilares de bienestar."
    },
    {
      icon: <Activity className="w-5 h-5" />,
      title: "Hábitos Reales",
      description: "No creo en las dietas extremas, sino en hábitos sostenibles para el día a día."
    }
  ];

  return (
    <section id="about" className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        
        {/* Images */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative h-full w-full min-h-[500px]"
        >
          {/* Main Photo */}
          <div className="relative z-10 w-4/5 h-[450px] lg:h-[600px] ml-auto overflow-hidden shadow-2xl">
            <img 
              src="https://images.unsplash.com/photo-1559209537-dafe2fe2886b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBvZmZpY2UlMjBjbGluaWN8ZW58MXx8fHwxNzczMDQ2MjI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
              alt="Consultorio brillante y moderno" 
              className="w-full h-full object-cover"
            />
          </div>
          {/* Overlapping Photo */}
          <div className="absolute bottom-10 left-0 z-20 w-3/5 h-[300px] shadow-xl border-4 border-white overflow-hidden">
             <img 
              src="https://images.unsplash.com/photo-1617175093766-18ed657a5c33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwdml0YW1pbnMlMjBzdXBwbGVtZW50cyUyMGZsYXRsYXl8ZW58MXx8fHwxNzczMDQ2MjE3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
              alt="Suplementos y vitaminas" 
              className="w-full h-full object-cover"
            />
          </div>
          {/* Deco Pattern */}
          <div className="absolute top-1/4 right-0 w-32 h-32 bg-emerald-50 rounded-full -z-10 blur-3xl opacity-50" />
        </motion.div>

        {/* Text */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <p className="text-emerald-800 font-medium tracking-widest text-sm uppercase mb-3">
            Detrás de la Bata
          </p>
          <h2 className="text-4xl lg:text-5xl font-serif text-stone-900 leading-tight mb-8">
            Soy médica, empresaria y madre de dos niños increíbles.
          </h2>
          <p className="text-stone-600 mb-6 leading-relaxed">
            Mi viaje hacia la medicina funcional comenzó buscando respuestas para mí misma. 
            Como madre y empresaria, experimenté de primera mano el agotamiento y la falta de energía 
            que la vida moderna a menudo impone a las mujeres.
          </p>
          <p className="text-stone-600 mb-12 leading-relaxed">
            Descubrí que la clave no estaba en trabajar menos, sino en optimizar mi cuerpo desde adentro. 
            El cuidado celular, el poder de las vitaminas estratégicas y la construcción de hábitos inteligentes 
            transformaron mi vida, y ahora me dedico a guiar a otras mujeres para que logren su mejor versión.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {values.map((item, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="mt-1 flex items-center justify-center p-3 rounded-full bg-emerald-50 text-emerald-800 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-serif text-lg text-stone-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-stone-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
