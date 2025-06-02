import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectGeneratorService } from '../../services/project-generator.service';
import {ToastrService } from 'ngx-toastr'; 

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

  constructor(
    private projectGenerator: ProjectGeneratorService,
    private toastr: ToastrService
  ) {}

  async generate() {
    if (!this.projectName) {
      this.toastr.warning('Por favor ingresa un nombre para el proyecto', 'Atención');
      return;
    }
    if (!this.diagramData) {
      this.toastr.error('No hay datos de diagrama disponibles', 'Error');
      return;
    }
    try {
      await this.projectGenerator.generateProject(this.projectName, this.diagramData);
      this.toastr.success('Proyecto generado correctamente', 'Éxito');
    } catch (error) {
      this.toastr.error('Error al generar el proyecto: ' + error, 'Error');
    }
  }
}
