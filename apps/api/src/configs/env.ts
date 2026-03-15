interface ENV {
  PORT: number;
  DATABASE_URL: string;
}

function loadENV(): ENV {
  const { PORT, DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    throw new Error("Error in loading DATABASE_URL from ENV!");
  }

  const portNumber = Number(PORT) || 4000;

  return {
    PORT: portNumber,
    DATABASE_URL: DATABASE_URL,
  };
}

export default loadENV();
