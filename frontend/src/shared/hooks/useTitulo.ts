import { useEffect } from "react";
//Metatitle hook to set the title of the page dynamically based on the provided title. It also resets the title to a default value when the component is unmounted.
export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | FitZone Sports`;
    return () => {
      document.title = "FitZone Sports";
    };
  }, [titulo]);
}
