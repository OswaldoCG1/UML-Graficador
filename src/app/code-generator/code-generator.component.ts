import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectGeneratorService } from '../../services/project-generator.service';

@Component({
  selector: 'app-code-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './code-generator.component.html',
  styleUrl: './code-generator.component.css'
})
export class CodeGeneratorComponent {
  projectName = 'my-project';
  constructor(private generator: ProjectGeneratorService) {}


  async ngOnInit() {
    await this.generator.loadTemplate();
  }
  
  /*generate() {
    if (this.projectName) {
      this.generator.generateProject(this.projectName);
    }
  }*/

    generate() {
    if (this.projectName) {
      const diagramData = JSON.parse(diagram.model.toJson());
      this.generator.generateProject(this.projectName, diagramData);
    }
  }

}
