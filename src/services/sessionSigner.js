export const generateSignature = (messages) => {
  // Simuleret signatur-generering baseret på AI-opsamling
  return {
    timestamp: new Date().toISOString(),
    decisions: messages.filter(m => m.includes('Beslutning') || m.includes('Valgt')),
    summary: "Refaktoreret App.jsx til Hermes OS fundament."
  };
};
