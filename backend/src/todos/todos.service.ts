import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';
import { Todo } from './entities/todo.entity.js';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly repo: Repository<Todo>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  create(dto: CreateTodoDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateTodoDto) {
    const todo = await this.repo.preload({ id, ...dto });
    if (!todo) {
      throw new NotFoundException(`Todo ${id} not found`);
    }

    return this.repo.save(todo);
  }

  async remove(id: number): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Todo ${id} not found`);
    }
  }
}
