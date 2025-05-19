import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';
import { DiagramData } from '../app/diagram-data';
import { ClaseDiagrama } from '../app/diagram-data';

@Injectable({
  providedIn: 'root'
})


export class ProjectGeneratorService {
  private angularTemplateZip!: JSZip;
  private expressTemplateZip!: JSZip;
  private templatesLoaded = false;

  

  constructor(private http: HttpClient) { }


  
  async loadTemplates(): Promise<void> {
    try {
      const angularTemplate = await this.http.get('/assets/angular-template.zip', {
        responseType: 'blob'
      }).toPromise();

      const expressTemplate = await this.http.get('/assets/express-template.zip', {
        responseType: 'blob'
      }).toPromise();

      if (!angularTemplate || !expressTemplate) {
        throw new Error('Plantillas no encontradas');
      }

      this.angularTemplateZip = await JSZip.loadAsync(angularTemplate);
      this.expressTemplateZip = await JSZip.loadAsync(expressTemplate);
      this.templatesLoaded = true;
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      throw error;
    }
  }

  async generateProject(projectName: string, diagramData: any) {
    try {
      if (!this.templatesLoaded) {
        await this.loadTemplates();
      }

      const zip = new JSZip();
      
      // Verificar que las plantillas están cargadas
      if (!this.angularTemplateZip || !this.expressTemplateZip) {
        throw new Error('Plantillas no inicializadas');
      }

      // Copiar archivos del template Angular
      await this.copyTemplateFiles(zip, projectName, this.angularTemplateZip, 'frontend');
      
      // Copiar archivos del template Express
      await this.copyTemplateFiles(zip, projectName, this.expressTemplateZip, 'backend');
      
      // === GENERAR COMPONENTES ANGULAR SEGÚN CLASES DEL DIAGRAMA ===
      console.log('Diagrama recibido:', diagramData);
      // Extraer clases del diagrama
      const classes = this.extractClassesFromDiagram(diagramData);
      console.log('Clases extraídas del diagrama:', classes);
      for (const classData of classes) {
        const className = classData.nombre.replace(/\s/g, '');
        const code = this.generateAngularComponentCode(classData);
        // Ejemplo: frontend/src/app/clase1/clase1.component.ts
        const filePath = `${projectName}/frontend/frontend/src/app/${className.toLowerCase()}/${className.toLowerCase()}.component.ts`;
        zip.file(filePath, code);
      }

      // Generar ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${projectName}.zip`);
      
    } catch (error) {
      console.error('Error al generar el proyecto:', error);
      throw error;
    }
  }

  private async copyTemplateFiles(zip: JSZip, projectName: string, templateZip: JSZip, folderName: string) {
    const files = templateZip.files;
    
    // Convertir el objeto files a array
    const fileEntries = Object.keys(files).map(key => ({
      relativePath: key,
      file: files[key]
    }));

    for (const entry of fileEntries) {
      const content = await entry.file.async('uint8array');
      const newPath = `${projectName}/${folderName}/${entry.relativePath}`;
      zip.file(newPath, content);
    }
  }

  
  /*private extractClassesFromDiagram(diagramData: any): any[] {
    if (!diagramData || !diagramData.nodeDataArray) return [];
    console.log('Diagrama de clases:', diagramData);
    console.log('Array de nodos:', diagramData.nodeDataArray);
    // Considera como clase si tiene nombre y al menos atributos o metodos como array
    return diagramData.nodeDataArray.filter((node: any) => node.nombre);
  }*/

    
private extractClassesFromDiagram(diagramData: DiagramData): ClaseDiagrama[] {
    // Validar estructura del diagrama
    const safeData: DiagramData = diagramData || {};
    //console.log('SafeData:', safeData);
    //console.log('nodeDataArray:', safeData.nodeDataArray);
  //  console.log('class:', safeData.class);
  const nodes = Array.isArray(safeData.nodeDataArray) 
    ? safeData.nodeDataArray 
    : [];
    //console.log('nodes:', nodes);
    console.log('nodeDataArray type:', typeof diagramData.nodeDataArray);
console.log('nodeDataArray content:', diagramData.nodeDataArray);

  if (!this.isValidDiagramData(diagramData)) {
    throw new Error('Formato de diagrama inválido');
  }
  /*return diagramData.nodeDataArray.map(node => ({
    nombre: node.nombre,
    atributos: node.atributos.map(attr => {
      const [nombre, tipo] = this.parsearPropiedad(attr.text);
      return {
        nombre: nombre.trim(),
        tipo: this.validarTipo(tipo.trim())
      };
    }),
    metodos: node.metodos.map(method => {
      const [nombre, tipoRetorno] = this.parsearMetodo(method.text);
      return {
        nombre: nombre.trim(),
        tipoRetorno: this.validarTipo(tipoRetorno.trim())
      };
    })
  }));*/
   // Mapear con valor por defecto si nodeDataArray está vacío
    return nodes.map(node => {
    try {
      return {
        nombre: node.nombre?.trim() || 'ClaseSinNombre',
        atributos: (node.atributos || []).map(attr => {
          const [nombre, tipo] = this.parsearPropiedad(attr.text || '');
          return { nombre: nombre.trim(), tipo: this.validarTipo(tipo.trim()) };
        }),
        metodos: (node.metodos || []).map(method => {
          const [nombre, tipoRetorno] = this.parsearMetodo(method.text || '');
          return { nombre: nombre.trim(), tipoRetorno: this.validarTipo(tipoRetorno.trim()) };
        })
      };
    } catch (error) {
      console.warn('Error procesando nodo:', node, error);
      return {
        nombre: 'ClaseInvalida',
        atributos: [],
        metodos: []
      };
    }
  });
}

  private generateAngularComponentCode(classData: any): string {
    const className = classData.nombre.replace(/\s/g, '');
    const selector = `app-${className.toLowerCase()}`;
    const atributos = (classData.atributos || [])
      .map((a: any) => {
        // "+ nombre: tipo"
        const match = a.text.match(/([+\-#])?\s*([\w\d_]+)\s*:\s*([\w\d_]+)/);
        if (match) {
          return `  ${match[2]}: ${match[3]};`;
        }
        return `  // ${a.text}`;
      })
      .join('\n');
    const metodos = (classData.metodos || [])
      .map((m: any) => {
        // "+ nombre(): tipo"
        const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
        if (match) {
          return `  ${match[2]}(): ${match[3]} {\n    // TODO: implementar\n  }`;
        }
        return `  // ${m.text}`;
      })
      .join('\n\n');
    return `
import { Component } from '@angular/core';

@Component({
  selector: '${selector}',
  template: \`
    <h2>${classData.nombre}</h2>
    <!-- CRUD aquí -->
  \`
})
export class ${className}Component {
${atributos}
${metodos}

// TODO: CRUD básico aquí
}
`.trim();
  }

    private parsearPropiedad(texto: string): [string, string] {
    const cleaned = texto.replace(/^[+\-~#]/, '').trim(); // Eliminar modificador acceso
    const partes = cleaned.split(':').map(p => p.trim());
    return [partes[0], partes.length > 1 ? partes[1] : 'string']; // Si no hay tipo, por defecto 'string'
  }

  private parsearMetodo(texto: string): [string, string] {
    const cleaned = texto.replace(/^[+\-~#]/, '').trim();
    const match = cleaned.match(/(.*?)\((.*?)\)\s*:\s*(.*)/) || [cleaned, '', '', 'void'];
    return [match[1], match[3] || 'void'];
  }

  private validarTipo(tipo: string): string {
    const tiposValidos = ['string', 'number', 'boolean', 'Date', 'void', 'any'];
    return tiposValidos.includes(tipo) ? tipo : 'string';
  }

  private isValidDiagramData(data: any): data is DiagramData {
    console.log('Validando datos del diagrama:', data);
    
  return data && 
         Array.isArray(data.nodeDataArray) && 
         data.nodeDataArray.every((node: any) => 
           node.nombre && 
           Array.isArray(node.atributos) && 
           Array.isArray(node.metodos)
         );
  }

  private parseDiagramData(jsonString: string): DiagramData {
  try {
    const parsed = JSON.parse(jsonString);
    if (!this.isValidDiagramData(parsed)) {
      throw new Error('Estructura del diagrama incorrecta');
    }
    return parsed;
  } catch (error) {
    console.error('Error parseando diagrama:', error);
    return {
      class: 'GraphLinksModel',
      nodeDataArray: [],
      linkDataArray: []
    };
  }
}
}