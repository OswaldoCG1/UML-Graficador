import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectGeneratorService } from '../../services/project-generator.service';

@Component({
  selector: 'app-code-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './code-generator.component.html',
  styleUrls: ['./code-generator.component.css']
})
export class CodeGeneratorComponent {
  @Input() diagramData: any; // Recibe los datos del diagrama desde el padre
  projectName: string = '';

  constructor(private projectGenerator: ProjectGeneratorService) {}

  async generate() {
    if (!this.projectName) {
      alert('Por favor ingresa un nombre para el proyecto');
      return;
    }
    if (!this.diagramData) {
      alert('No hay datos de diagrama disponibles');
      return;
    }
    try {
      await this.projectGenerator.generateProject(this.projectName, this.diagramData);
    } catch (error) {
      alert('Error al generar el proyecto: ' + error);
    }
  }
}
