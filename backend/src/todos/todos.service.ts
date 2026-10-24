import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';
import { Todo } from './entities/todo.entity.js';

type TodoResponse = Pick<Todo, 'id' | 'title' | 'status' | 'priority'>;

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly repo: Repository<Todo>,
  ) {}

  async findAll(user: AuthUser): Promise<TodoResponse[]> {
    const todos = await this.repo.find({
      where: { ownerId: user.id },
      order: { id: 'ASC' },
    });
    return todos.map((todo) => this.toResponse(todo));
  }

  async create(dto: CreateTodoDto, user: AuthUser): Promise<TodoResponse> {
    const todo = await this.repo.save(
      this.repo.create({
        title: dto.title,
        status: dto.status,
        priority: dto.priority,
        ownerId: user.id,
      }),
    );
    return this.toResponse(todo);
  }

  async update(
    id: number,
    dto: UpdateTodoDto,
    user: AuthUser,
  ): Promise<TodoResponse> {
    const todo = await this.repo.findOne({
      where: { id, ownerId: user.id },
    });
    if (!todo) {
      throw new NotFoundException(`Todo ${id} not found`);
    }

    Object.assign(todo, dto);
    return this.toResponse(await this.repo.save(todo));
  }

  async remove(id: number, user: AuthUser): Promise<void> {
    const result = await this.repo.delete({ id, ownerId: user.id });
    if (!result.affected) {
      throw new NotFoundException(`Todo ${id} not found`);
    }
  }

  private toResponse(todo: Todo): TodoResponse {
    return {
      id: todo.id,
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
    };
  }
}
