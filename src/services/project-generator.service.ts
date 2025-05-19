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

      // Copiar archivos del template Angular
      await this.copyTemplateFiles(zip, projectName, this.angularTemplateZip, 'frontend');
      // Copiar archivos del template Express
      await this.copyTemplateFiles(zip, projectName, this.expressTemplateZip, 'backend');

      // === GENERAR COMPONENTES ANGULAR SEGÚN CLASES DEL DIAGRAMA ===
      const classes = this.extractClassesFromDiagram(diagramData);

      // 1. Leer el archivo de rutas original (standalone)
      const routesPath = 'frontend/src/app/app.routes.ts';
      const zipRoutesPath = `${projectName}/frontend/${routesPath}`;
      let routesContent = await this.angularTemplateZip.file(routesPath)?.async('string');
      if (!routesContent) {
        throw new Error('No se encontró app.routes.ts en la plantilla');
      }

      // 2. Generar imports y rutas
      let imports = '';
      let routes = '';
      for (const classData of classes) {
        const className = classData.nombre.replace(/\s/g, '');
        const kebabName = className.toLowerCase();
        // Generar componente
        const code = this.generateAngularComponentCode(classData);
        const compPath = `${projectName}/frontend/frontend/src/app/${kebabName}/${kebabName}.component.ts`;
        zip.file(compPath, code);

        // Import y ruta (standalone)
        imports += `import { ${className}Component } from './${kebabName}/${kebabName}.component';\n`;
        routes += `  { path: '${kebabName}', component: ${className}Component },\n`;
      }

      // 3. Insertar imports y rutas en el archivo de rutas
      // Insertar imports después de los imports existentes
      routesContent = routesContent.replace(
        /(import[^\n]+;\s*)+/,
        match => match + imports
      );
      // Insertar rutas en el array de rutas
      routesContent = routesContent.replace(
        /const routes: Routes = \[/,
        `const routes: Routes = [\n${routes}`
      );

      // 4. Sobrescribir el archivo de rutas en el ZIP
      zip.file(zipRoutesPath, routesContent);

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

  
private extractClassesFromDiagram(diagramData: any): any[] {
  if (!diagramData) {
    console.warn('No diagramData recibido');
    return [];
  }
  //si viene como string intenta parsear
  if (typeof diagramData === 'string') {
    try {
      diagramData = JSON.parse(diagramData);
    } catch {
      console.warn('diagramData no es JSON válido');
      return [];
    }
  }
  //nodeDataArray existe y es array
  const nodes = Array.isArray(diagramData.nodeDataArray)
    ? diagramData.nodeDataArray
    : [];
  console.log('nodeDataArray extraído:', nodes);

  // Considera como clase cualquier nodo con nombre
  return nodes.filter((node: any) => node && node.nombre && node.atributos && node.metodos);
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