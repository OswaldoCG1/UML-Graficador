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
const relations = this.extractRelationsFromDiagram(diagramData);

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

        // Generar TypeScript
        const code = this.generateAngularComponentCode(classData, classes, relations);
        const compPath = `${projectName}/frontend/frontend/src/app/componentes/generados/${kebabName}/${kebabName}.component.ts`;
        zip.file(compPath, code);

        // Generar HTML
        const html = this.generateAngularComponentHtml(classData);
        const htmlPath = `${projectName}/frontend/frontend/src/app/componentes/generados/${kebabName}/${kebabName}.component.html`;
        zip.file(htmlPath, html);

        // (Opcional: CSS vacío)
        const cssPath = `${projectName}/frontend/frontend/src/app/componentes/generados/${kebabName}/${kebabName}.component.css`;
        zip.file(cssPath, '');

        // Import y ruta (standalone)
        imports += `import { ${className}Component } from './componentes/generados/${kebabName}/${kebabName}.component';\n`;
        routes += `  { path: '${kebabName}', component: ${className}Component, canActivate: [authGuard] },\n`;
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

      // 5. Actualizar el menú con las clases generadas
      const menuPath = 'frontend/src/app/componentes/menu/menu.component.html';
      const zipMenuPath = `${projectName}/frontend/${menuPath}`;
      let menuContent = await this.angularTemplateZip.file(menuPath)?.async('string');
  //    console.log('Contenido del menú original:', menuContent);
      if (menuContent) {
        // Encuentra el <ul class="dropdown-menu"> y agrega las clases
        menuContent = menuContent.replace(
          /(<ul class="dropdown-menu">)([\s\S]*?)(<\/ul>)/,
          (match, start, middle, end) => {
            const items = classes.map(c =>
              `<li><a class="dropdown-item" routerLink="/${c.nombre.toLowerCase()}">${this.capitalize(c.nombre)}</a></li>`
            ).join('\n');
            return `${start}\n${items}\n${end}`;
          } 
        );
        zip.file(zipMenuPath, menuContent);
      }

      // Generar archivo db.js
      const dbJsContent = this.generateSequelizeDbFile(classes, relations);
      zip.file(`${projectName}/backend/backend/db.js`, dbJsContent);


      for (const classData of classes) {
          const className = classData.nombre.replace(/\s/g, '');
          const tableName = className.toLowerCase();

          // Controller
          const controllerContent = this.generateExpressController(classData, relations, classes);
          zip.file(`${projectName}/backend/backend/controllers/${tableName}.controller.js`, controllerContent);

          // Route
          const routeContent = this.generateExpressRoute(classData, relations);
          zip.file(`${projectName}/backend/backend/routes/${tableName}.js`, routeContent);
        }
      // Leer app.js original de la plantilla
      const appJsPath = 'backend/app.js';
      const zipAppJsPath = `${projectName}/backend/backend/app.js`;
      let appJsContent = await this.expressTemplateZip.file('backend/app.js')?.async('string');
      console.log('Contenido de app.js original:', appJsContent);

      if (appJsContent) {
        const { imports, uses } = this.generateExpressRoutesRegistration(classes);

        // Reemplazar imports de rutas
        appJsContent = appJsContent.replace(
          /(var\s+\w+Router\s*=\s*require\(['"][^'"]+['"]\);\s*)+/,
          match => match + '\n' + imports + '\n'
        );

        // Reemplazar app.use de rutas
        appJsContent = appJsContent.replace(
          /(app\.use\(['"][^'"]+['"],\s*\w+Router\);\s*)+/,
          match => match + '\n' + uses + '\n'
        );

        zip.file(zipAppJsPath, appJsContent);
      }


      const packages = this.extractPackagesFromDiagram(diagramData);

      for (const pkg of packages) {
        const folderName = pkg.nombre.replace(/\s/g, '');
        // Crear carpeta en frontend
        zip.folder(`${projectName}/frontend/frontend/${folderName}`);
        // Crear carpeta en backend
        zip.folder(`${projectName}/backend/backend/${folderName}`);
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

  private generateAngularComponentCode(classData: any, classes: any[], relations: any[]): string {
  const className = classData.nombre.replace(/\s/g, '');
  const selector = `app-${className.toLowerCase()}`;
  const atributos = (classData.atributos || [])
    .map((a: any) => {
      const match = a.text.match(/([+\-#])?\s*([\w\d_]+)\s*:\s*([\w\d_]+)/);
      if (match) {
        return `  ${match[2]}: ${match[3]};`;
      }
      return `  // ${a.text}`;
    })
    .join('\n');

  // --- Herencia de métodos ---
  // 1. Busca si esta clase hereda de otra
  const herencia = relations.find(rel =>
    rel.category === 'Herencia' &&
    (rel.from === classData.key || rel.from === classData.nombre)
  );
  let parentMethods: any[] = [];
  if (herencia) {
    const parentClass = classes.find(c => c.key === herencia.to || c.nombre === herencia.to);
    if (parentClass) {
      parentMethods = parentClass.metodos || [];
    }
  }
  // 2. Une métodos propios y heredados (sin duplicados)
  const allMethods = [
    ...(classData.metodos || []),
    ...parentMethods.filter(pm =>
      !(classData.metodos || []).some((m: any) => m.text === pm.text)
    )
  ];

  const metodos = allMethods
    .map((m: any) => {
      const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
      if (match) {
        return `  ${match[2]}(): ${match[3]} {\n    // TODO: implementar\n  }`;
      }
      return `  // ${m.text}`;
    })
    .join('\n\n');

  return `
import { Component } from '@angular/core';
import { MenuComponent } from "../../menu/menu.component";

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [MenuComponent],
  templateUrl: './${className}.component.html',
  styleUrls: ['./${className}.component.css']
})
export class ${className}Component {
/*${atributos}
${metodos}
*/
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

private generateAngularComponentHtml(classData: any): string {
  const atributos = (classData.atributos || [])
    .map((a: any) => {
      const match = a.text.match(/([+\-#])?\s*([\w\d_]+)\s*:\s*([\w\d_]+)/);
      if (match) {
        const nombre = match[2];
        const tipo = match[3];
        let inputType = 'text';
        if (tipo.toLowerCase().includes('int') || tipo.toLowerCase().includes('float') || tipo.toLowerCase().includes('number')) {
          inputType = 'number';
        }
        return `
        <div class="col-md-6">
          <div class="form-group">
            <label>${this.capitalize(nombre)} (${this.capitalize(tipo)}):</label>
            <input type="${inputType}" class="form-control" placeholder="Ingrese ${nombre}">
          </div>
        </div>`;
      }
      return '';
    })
    .join('\n');

  const metodos = (classData.metodos || [])
    .map((m: any) => {
      const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
      if (match) {
        const nombre = this.capitalize(match[2]);
        return `
        <div class="col-md-4">
          <button class="btn btn-primary w-100">${nombre}</button>
        </div>`;
      }
      return '';
    })
    .join('\n');

  return `
<app-menu></app-menu> 
<div class="container mt-4">
  <h2 class="mb-4">${this.capitalize(classData.nombre)}</h2>

  <div class="card mb-4">
    <div class="card-header">
      <h4>Propiedades</h4>
    </div>
    <div class="card-body">
      <div class="row g-3">
        ${atributos}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h4>Métodos</h4>
    </div>
    <div class="card-body">
      <div class="row g-3">
        ${metodos}
      </div>
    </div>
  </div>
</div>
`.trim();
}

private capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

private generateSequelizeDbFile(classes: any[], relations: any[]): string {
  const typeMap: Record<string, string> = {
    string: 'Sequelize.STRING',
    number: 'Sequelize.INTEGER',
    int: 'Sequelize.INTEGER',
    float: 'Sequelize.FLOAT',
    boolean: 'Sequelize.BOOLEAN',
    date: 'Sequelize.DATE',
    any: 'Sequelize.STRING'
  };

  // Modelos
  const models = classes.map(classData => {
    const className = classData.nombre.replace(/\s/g, '');
    const tableName = className.toLowerCase();
    const fields = (classData.atributos || [])
      .map((a: any) => {
        const match = a.text.match(/([+\-#])?\s*([\w\d_]+)\s*:\s*([\w\d_]+)/);
        if (match) {
          const nombre = match[2];
          const tipo = match[3].toLowerCase();
          const sequelizeType = typeMap[tipo] || 'Sequelize.STRING';
          return `    ${nombre}: { type: ${sequelizeType} }`;
        }
        return '';
      })
      .filter(Boolean)
      .join(',\n');
    return `
const ${className} = sequelize.define('${tableName}', {
${fields}
});
`;
  }).join('\n');

  // Relaciones
  let associations = '';
  for (const rel of relations) {
    const fromClass = classes.find(c => c.key === rel.from || c.nombre === rel.from);
    const toClass = classes.find(c => c.key === rel.to || c.nombre === rel.to);
    if (!fromClass || !toClass) continue;
    const fromName = fromClass.nombre.replace(/\s/g, '');
    const toName = toClass.nombre.replace(/\s/g, '');

    if (rel.category === 'Herencia') {
      // Comentario para herencia
      associations += `// ${fromName} hereda de ${toName} (herencia UML, requiere lógica manual)\n`;
    } else if (rel.category === 'Agregacion') {
      // Agregación simple: belongsTo/hasMany
      associations += `${fromName}.belongsTo(${toName});\n`;
      associations += `${toName}.hasMany(${fromName});\n`;
    } else if (rel.category === 'AgregacionMultiple') {
      // Agregación múltiple: belongsToMany
      associations += `${fromName}.belongsToMany(${toName}, { through: '${fromName}_${toName}' });\n`;
      associations += `${toName}.belongsToMany(${fromName}, { through: '${fromName}_${toName}' });\n`;
    }
  }

  const syncModels = classes.map(classData => {
    const className = classData.nombre.replace(/\s/g, '');
    return `${className}.sync();`;
  }).join('\n');

  return `
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('database', 'user', 'password', {
  dialect: 'sqlite',
  storage: './database.sqlite'
});

${models}

// === Relaciones entre modelos ===
${associations}

${syncModels}

module.exports = sequelize;
`.trim();
}

private generateExpressController(classData: any, relations: any[], classes: any[]): string {
  const className = classData.nombre.replace(/\s/g, '');
  const modelName = className;
  const tableName = className.toLowerCase();
  const idField = 'id';

  // Detectar relaciones de la clase
  const classRelations = this.getClassRelations(classData, relations);

  // --- Herencia de métodos ---
  // 1. Busca si esta clase hereda de otra
  const herencia = relations.find(rel =>
    rel.category === 'Herencia' &&
    (rel.from === classData.key || rel.from === classData.nombre)
  );
  let parentMethods: any[] = [];
  if (herencia) {
    const parentClass = classes.find(c => c.key === herencia.to || c.nombre === herencia.to);
    if (parentClass) {
      parentMethods = parentClass.metodos || [];
    }
  }
  // 2. Une métodos propios y heredados (sin duplicados)
  const allMethods = [
    ...(classData.metodos || []),
    ...parentMethods.filter(pm =>
      !(classData.metodos || []).some((m: any) => m.text === pm.text)
    )
  ];

  // Métodos vacíos
  const metodos = allMethods.map((m: any) => {
    const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
    if (match) {
      const nombre = match[2];
      return `
exports.${nombre} = async (req, res) => {
  // TODO: Implementar método ${nombre}
  res.status(501).json({ message: 'No implementado' });
};`;
    }
    return '';
  }).join('\n');

  // Métodos adicionales para relaciones
  let extraMethods = '';

  // getAllWithRelationships
  if (classRelations.length > 0) {
    extraMethods += `
exports.getAllWithRelationships = async (req, res) => {
  const items = await db.models.${modelName}.findAll({ include: { all: true } });
  res.json(items);
};`;
  }

  // getActive (ejemplo: si tiene campo "activo" o similar)
  if ((classData.atributos || []).some((a: any) => /activo|active/i.test(a.text))) {
    extraMethods += `
exports.getActive = async (req, res) => {
  const items = await db.models.${modelName}.findAll({ where: { activo: true } });
  res.json(items);
};`;
  }

  // getByRelatedId para agregaciones simples/múltiples
  for (const rel of classRelations) {
    if (rel.category === 'Agregacion' || rel.category === 'AgregacionMultiple') {
      const relatedClass = rel.from === (classData.key || classData.nombre)
        ? rel.to
        : rel.from;
      const relatedClassName = typeof relatedClass === 'string'
        ? relatedClass.replace(/\s/g, '')
        : (relatedClass.nombre ? relatedClass.nombre.replace(/\s/g, '') : String(relatedClass));
      const relatedField = relatedClassName.toLowerCase() + 'Id';
      extraMethods += `
exports.getBy${relatedClassName} = async (req, res) => {
  const items = await db.models.${modelName}.findAll({ where: { ${relatedField}: req.params.id } });
  res.json(items);
};`;
    }
  }

  return `
const db = require('../db');

// Obtener todos
exports.getAll = async (req, res) => {
  const items = await db.models.${modelName}.findAll();
  res.json(items);
};

// Obtener uno
exports.getOne = async (req, res) => {
  const item = await db.models.${modelName}.findByPk(req.params.${idField});
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
};

// Crear
exports.create = async (req, res) => {
  const nuevo = await db.models.${modelName}.create(req.body);
  res.status(201).json(nuevo);
};

// Actualizar
exports.update = async (req, res) => {
  const item = await db.models.${modelName}.findByPk(req.params.${idField});
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  await item.update(req.body);
  res.json(item);
};

// Eliminar
exports.remove = async (req, res) => {
  const item = await db.models.${modelName}.findByPk(req.params.${idField});
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  await item.destroy();
  res.json({ success: true });
};

${extraMethods}
${metodos}
`.trim();
}

private generateExpressRoute(classData: any, relations: any[]): string {
  const className = classData.nombre.replace(/\s/g, '');
  const tableName = className.toLowerCase();
  const idField = 'id';

  // Detectar relaciones de la clase
  const classRelations = this.getClassRelations(classData, relations);

  // Métodos extra
  let extraRoutes = '';
  if (classRelations.length > 0) {
    extraRoutes += `router.get('/with-relationships', controller.getAllWithRelationships);\n`;
  }
  if ((classData.atributos || []).some((a: any) => /activo|active/i.test(a.text))) {
    extraRoutes += `router.get('/active', controller.getActive);\n`;
  }
  for (const rel of classRelations) {
    if (rel.category === 'Agregacion' || rel.category === 'AgregacionMultiple') {
      const relatedClass = rel.from === (classData.key || classData.nombre)
        ? rel.to
        : rel.from;
      const relatedClassName = typeof relatedClass === 'string'
  ? relatedClass.replace(/\s/g, '')
  : (relatedClass.nombre ? relatedClass.nombre.replace(/\s/g, '') : String(relatedClass));
      extraRoutes += `router.get('/by-${relatedClassName.toLowerCase()}/:id', controller.getBy${relatedClassName});\n`;
    }
  }

  // Métodos personalizados
  const metodos = (classData.metodos || []).map((m: any) => {
    const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
    if (match) {
      const nombre = match[2];
      return `router.post('/${nombre}', controller.${nombre});`;
    }
    return '';
  }).join('\n');

  return `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/${tableName}.controller');

// CRUD
router.get('/', controller.getAll);
router.get('/:${idField}', controller.getOne);
router.post('/', controller.create);
router.put('/:${idField}', controller.update);
router.delete('/:${idField}', controller.remove);

// Métodos adicionales para relaciones
${extraRoutes}

// Métodos personalizados
${metodos}

module.exports = router;
`.trim();
}

private generateExpressRoutesRegistration(classes: any[]): { imports: string, uses: string } {
  const imports = classes.map(classData => {
    const className = classData.nombre.replace(/\s/g, '');
    const tableName = className.toLowerCase();
    return `var ${tableName}Router = require('./routes/${tableName}');`;
  }).join('\n');

  const uses = classes.map(classData => {
    const className = classData.nombre.replace(/\s/g, '');
    const tableName = className.toLowerCase();
    return `app.use('/api/${tableName}', ${tableName}Router);`;
  }).join('\n');

  return { imports, uses };
}

private extractPackagesFromDiagram(diagramData: any): any[] {
  if (!diagramData) return [];
  if (typeof diagramData === 'string') {
    try {
      diagramData = JSON.parse(diagramData);
    } catch {
      return [];
    }
  }
  const nodes = Array.isArray(diagramData.nodeDataArray) ? diagramData.nodeDataArray : [];
  return nodes.filter((node: any) => node && node.category === "Package" && node.nombre);
}

private extractRelationsFromDiagram(diagramData: any): any[] {
  if (!diagramData) return [];
  if (typeof diagramData === 'string') {
    try {
      diagramData = JSON.parse(diagramData);
    } catch {
      return [];
    }
  }
  const links = Array.isArray(diagramData.linkDataArray) ? diagramData.linkDataArray : [];
  return links.filter((link: any) => link.category && link.from && link.to);
}
private getClassRelations(classData: any, relations: any[]): any[] {
  const classKey = classData.key || classData.nombre;
  return relations.filter(rel => rel.from === classKey || rel.to === classKey);
}

private generateAngularServiceCode(classData: any, relations: any[], classes: any[]): string {
  const className = classData.nombre.replace(/\s/g, '');
  const kebabName = className.toLowerCase();
  const apiUrl = `/api/${kebabName}`;

  // Herencia de métodos
  const herencia = relations.find(rel =>
    rel.category === 'Herencia' &&
    (rel.from === classData.key || rel.from === classData.nombre)
  );
  let parentMethods: any[] = [];
  if (herencia) {
    const parentClass = classes.find(c => c.key === herencia.to || c.nombre === herencia.to);
    if (parentClass) {
      parentMethods = parentClass.metodos || [];
    }
  }
  const allMethods = [
    ...(classData.metodos || []),
    ...parentMethods.filter(pm =>
      !(classData.metodos || []).some((m: any) => m.text === pm.text)
    )
  ];

  // Métodos personalizados (standby)
  const customMethods = allMethods.map((m: any) => {
    const match = m.text.match(/([+\-#])?\s*([\w\d_]+)\s*\(\)\s*:\s*([\w\d_]+)/);
    if (match) {
      const nombre = match[2];
      return `
  ${nombre}(data: any): Observable<any> {
    return this.http.post<any>(\`${apiUrl}/${nombre}\`, data);
  }`;
    }
    return '';
  }).join('\n');

  return `
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ${className}Service {
  private apiUrl = '${apiUrl}';

  constructor(private http: HttpClient) {}

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(\`\${this.apiUrl}\`);
  }

  getOne(id: number): Observable<any> {
    return this.http.get<any>(\`\${this.apiUrl}/\${id}\`);
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(\`\${this.apiUrl}\`, data);
  }

  update(id: number, data: any): Observable<any> {
    return this.http.put<any>(\`\${this.apiUrl}/\${id}\`, data);
  }
${customMethods}
}
`.trim();
}