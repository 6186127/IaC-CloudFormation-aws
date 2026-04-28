# To-Do Application

This project contains:

- A frontend service built with HTML, CSS, and JavaScript.
- A backend service built with Node.js and Express.
- Browser `localStorage` caching in the frontend.
- Persistent todo storage in `backend/data/todos.json`.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Docker

Build the image:

```bash
docker build -t todo-app .
```

Run the container:

```bash
docker run -p 3000:3000 todo-app
```

## Microservice Images

Frontend image:

```bash
docker build -f frontend/Dockerfile -t todo-frontend .
```

Backend image:

```bash
docker build -f backend/Dockerfile -t todo-backend .
```

## AWS CloudFormation

CloudFormation 模板在 [infrastructure/cloudformation.yaml](/Users/yin/Desktop/lynn-assignment-Apr-code/infrastructure/cloudformation.yaml)。

### Parameters 是什么

`Parameters` 是模板顶部的一组可配置输入值。你部署模板时，可以给这些参数传不同的值，而不用修改模板正文。

例如这个模板里有：

- `AppName`：资源名前缀
- `FrontendContainerPort`：前端容器端口
- `BackendContainerPort`：后端容器端口
- `FrontendImageTag` / `BackendImageTag`：ECR 镜像 tag
- `FrontendDesiredCount` / `BackendDesiredCount`：ECS 任务副本数

### 如何操作

1. 先部署 CloudFormation，创建 VPC、ECR、ECS、ALB 等资源。
2. 把前后端镜像分别 build 并 push 到模板创建出来的两个 ECR 仓库。
3. 更新 CloudFormation 参数里的镜像 tag，触发 ECS 发布新版本。

示例部署命令：

```bash
aws cloudformation deploy \
  --stack-name todo-app-stack \
  --template-file infrastructure/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AppName=todo-app \
    FrontendContainerPort=3000 \
    BackendContainerPort=3000 \
    FrontendImageTag=latest \
    BackendImageTag=latest
```

查看输出：

```bash
aws cloudformation describe-stacks \
  --stack-name todo-app-stack \
  --query "Stacks[0].Outputs"
```

给 ECR 打标签并推送镜像的典型流程：

```bash
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<your-region>.amazonaws.com

docker build -f frontend/Dockerfile -t todo-frontend .
docker tag todo-frontend:latest <account-id>.dkr.ecr.<your-region>.amazonaws.com/todo-app-frontend:latest
docker push <account-id>.dkr.ecr.<your-region>.amazonaws.com/todo-app-frontend:latest

docker build -f backend/Dockerfile -t todo-backend .
docker tag todo-backend:latest <account-id>.dkr.ecr.<your-region>.amazonaws.com/todo-app-backend:latest
docker push <account-id>.dkr.ecr.<your-region>.amazonaws.com/todo-app-backend:latest
```

注意：当前后端把数据写在容器内 `backend/data/todos.json`。部署到 ECS/Fargate 后，这不是持久化数据库，任务重建后数据可能丢失。如果你要把这套架构真正用于长期运行，后端存储应改成 RDS、DynamoDB 或 EFS。

## API

- `GET /api/todos` - list all todos
- `POST /api/todos` - create a todo
- `PUT /api/todos/:id` - update a todo
- `DELETE /api/todos/:id` - delete a todo
