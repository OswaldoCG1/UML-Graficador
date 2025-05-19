// project-generator.service.ts
import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ProjectGeneratorService {
  private templateZip!: JSZip;

  constructor(private http: HttpClient) { }

  async loadTemplate(): Promise<void> {
    const template = await this.http.get('/assets/project-template.zip', 
      { responseType: 'blob' }).toPromise();
    this.templateZip = await JSZip.loadAsync(template!);
  }

 async generateProject(projectName: string, diagramData: any) {
    if (!this.templateZip) await this.loadTemplate();
    
    const zip = new JSZip();
    
    // Copiar todos los archivos del template
    await this.copyTemplateFiles(zip, projectName);
    
    // Aplicar personalizaciones
    await this.applyCustomizations(zip, diagramData, projectName);
    
    // Generar y descargar
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${projectName}.zip`);
  }

  

  private async copyTemplateFiles(zip: JSZip, projectName: string) {
    const promises: Promise<void>[] = [];
    
    this.templateZip.forEach((relativePath, file) => {
      const newPath = `${projectName}/${relativePath}`;
      promises.push(
        file.async('uint8array').then(content => {
          zip.file(newPath, content);
        })
      );
    });
    
    await Promise.all(promises);
  }

  private async applyCustomizations(zip: JSZip, diagramData: any, projectName: string) {
    // Actualizar frontend basado en el diagrama
    await this.updateFrontend(zip, diagramData, projectName);
  }

  private async updateFrontend(zip: JSZip, diagramData: any, projectName: string) {
    // Generar componentes
    const appFolder = zip.folder(`${projectName}/frontend/src/app`);
    
    diagramData.nodeDataArray.forEach((node: any) => {
      const componentName = this.sanitizeClassName(node.nombre);
      const componentFolder = appFolder?.folder(componentName);
      
      // Componente TypeScript
      componentFolder?.file(`${componentName}.component.ts`, 
        this.getComponentTs(componentName));
      
      // Template HTML
      componentFolder?.file(`${componentName}.component.html`,
        this.getComponentHtml(node));
      
      // CSS
      componentFolder?.file(`${componentName}.component.css`, '');
    });

    // Actualizar app.module.ts
    const appModulePath = `${projectName}/frontend/src/app/app.module.ts`;
    const originalModule = await zip.file(appModulePath)?.async('text') || '';
    const updatedModule = this.updateAppModule(originalModule, diagramData);
    zip.file(appModulePath, updatedModule);
  }

  private updateAppModule(originalContent: string, diagramData: any): string {
    // Añadir nuevos imports
    const newImports = diagramData.nodeDataArray.map((node: any) => 
      `import { ${this.sanitizeClassName(node.nombre)} } from './${this.sanitizeClassName(node.nombre)}/${this.sanitizeClassName(node.nombre)}.component';`
    ).join('\n');

    // Añadir a declarations
    const declarations = diagramData.nodeDataArray.map((node: any) => 
      this.sanitizeClassName(node.nombre)
    ).join(',\n    ');

    return originalContent
      .replace(/import {[^}]*} from '@angular\/core';/, `$&\n${newImports}`)
      .replace(/declarations: \[([^\]]*)\]/, `declarations: [\n    $1,\n    ${declarations}\n]`);
  }

  private sanitizeClassName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '') + 'Component';
  }

  
  private getComponentTs(componentName: string): string {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-${componentName.toLowerCase()}',
  templateUrl: './${componentName}.component.html',
  styleUrls: ['./${componentName}.component.css']
})
export class ${componentName}Component {
  // Atributos y métodos se añadirán dinámicamente
}
`;
  }

  private getComponentHtml(node: any): string {
    const attributes = node.atributos.map((attr: { text: string; }) => {
      const [name, type] = this.parseAttribute(attr.text);
      return `<p>${name}: ${type}</p>`;
    }).join('\n');

    const methods = node.metodos.map((method: { text: string; }) => {
      const methodName = this.parseMethodName(method.text);
      return `<button (click)="${methodName}()">${methodName}</button>`;
    }).join('\n');

    return `
<div class="class-container">
  <h2>${node.nombre}</h2>
  <div class="attributes">${attributes}</div>
  <div class="methods">${methods}</div>
</div>
`;
  }

 private parseAttribute(text: string): [string, string] {
    const cleaned = text.replace(/^[+\-~]/, '').trim(); // Remover modificadores de acceso
    const parts = cleaned.split(':').map(p => p.trim());
    const name = parts[0];
    const type = parts.length > 1 ? this.validateType(parts[1]) : 'string';
    return [name, type];
  }

  private parseMethodName(text: string): string {
    return text.split('(')[0].replace(/^[+\-~]/, '').trim();
  }

  private validateType(type: string): string {
    const validTypes = ['string', 'number', 'boolean', 'Date'];
    return validTypes.includes(type) ? type : 'string';
  }

  // Mantener los métodos sanitizeClassName, getComponentTs, getComponentHtml del código anterior
}

