import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, ParseIntPipe } from '@nestjs/common';
import { TodosService } from './todos.service.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';


@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

//   @Post()
//   create(@Body() createTodoDto: CreateTodoDto) {
//     return this.todosService.create(createTodoDto);
//   }

//   @Get()
//   findAll() {
//     return this.todosService.findAll();
//   }

//   @Get(':id')
//   findOne(@Param('id') id: string) {
//     return this.todosService.findOne(+id);
//   }

//   @Patch(':id')
//   update(@Param('id') id: string, @Body() updateTodoDto: UpdateTodoDto) {
//     return this.todosService.update(+id, updateTodoDto);
//   }

//   @Delete(':id')
//   remove(@Param('id') id: string) {
//     return this.todosService.remove(+id);
//   }
// }

  @Get()
  findAll() { return this.todos.findAll(); }
  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.todos.create(dto); // 201 by default
  }
  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTodoDto) {
    return this.todos.update(id, dto);
  }
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.todos.remove(id);
  }
  }