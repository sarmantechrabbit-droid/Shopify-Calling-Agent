// import { motion, AnimatePresence } from 'framer-motion';
// import { useTheme } from '../contexts/ThemeContext';

// export function ThemeToggle({ className = '' }) {
//   const { isDark, toggleTheme, theme } = useTheme();

//   return (
//     <motion.button
//       whileHover={{ scale: 1.05 }}
//       whileTap={{ scale: 0.95 }}
//       onClick={toggleTheme}
//       className={`
//         relative w-10 h-10 rounded-xl flex items-center justify-center
//         transition-colors duration-200
//         ${isDark
//           ? 'bg-dark-800 hover:bg-dark-700 text-amber-400'
//           : 'bg-light-100 hover:bg-light-200 text-indigo-600'
//         }
//         ${className}
//       `}
//       title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
//     >
//       <AnimatePresence mode="wait">
//         {isDark ? (
//           <motion.div
//             key="moon"
//             initial={{ rotate: -90, opacity: 0 }}
//             animate={{ rotate: 0, opacity: 1 }}
//             exit={{ rotate: 90, opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           >
//             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
//               <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
//             </svg>
//           </motion.div>
//         ) : (
//           <motion.div
//             key="sun"
//             initial={{ rotate: 90, opacity: 0 }}
//             animate={{ rotate: 0, opacity: 1 }}
//             exit={{ rotate: -90, opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           >
//             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
//               <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
//             </svg>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </motion.button>
//   );
// }

// export default ThemeToggle;
