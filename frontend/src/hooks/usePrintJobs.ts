import { useEffect, useState } from "react";
import { DataService, PrintJob } from "../services/DataService";

export function usePrintJobs() {
  const [jobs, setJobs] = useState<PrintJob[]>(() =>
    DataService.getPrintJobs()
  );

  useEffect(() => {
    const unsub = DataService.subscribePrintJobs(setJobs);
    return unsub;
  }, []);

  return { jobs };
}
