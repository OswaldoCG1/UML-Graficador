export interface ClaseDiagrama {
  nombre: string;
  atributos: { nombre: string; tipo: string }[];
  metodos: { nombre: string; tipoRetorno: string }[];
}

export interface DiagramData {
  class: string;
  nodeDataArray: Array<{
    nombre: string;
    atributos: Array<{ text: string }>;
    metodos: Array<{ text: string }>;
  }>;
    linkDataArray: any[];
}
