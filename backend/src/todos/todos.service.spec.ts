import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../auth/entities/user.entity.js';
import { Todo } from './entities/todo.entity.js';
import { TodosService } from './todos.service.js';

describe('TodosService', () => {
  let service: TodosService;
  const repository = {
    find: vi.fn(),
    create: vi.fn((todo) => todo),
    save: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
  };
  const user = { id: 'user-id', role: Role.USER };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: getRepositoryToken(Todo),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('only lists todos owned by the authenticated user', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll(user);

    expect(repository.find).toHaveBeenCalledWith({
      where: { ownerId: user.id },
      order: { id: 'ASC' },
    });
  });

  it('assigns a new todo to the authenticated user', async () => {
    repository.save.mockImplementation(async (todo) => ({
      ...todo,
      id: 1,
      status: 'TODO',
      priority: false,
    }));

    const result = await service.create({ title: 'My task' }, user);

    expect(repository.create).toHaveBeenCalledWith({
      title: 'My task',
      ownerId: user.id,
    });
    expect(result).toEqual({
      id: 1,
      title: 'My task',
      status: 'TODO',
      priority: false,
    });
  });

  it('does not update a todo owned by another user', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update(42, { title: 'Changed' }, user),
    ).rejects.toThrow('Todo 42 not found');
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 42, ownerId: user.id },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
