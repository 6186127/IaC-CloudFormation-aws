# To-Do Application

This project contains:

- A frontend service built with HTML, CSS, and JavaScript.
- A backend service built with Node.js and Express.
- Browser `localStorage` caching in the frontend.
- Persistent todo storage in `backend/data/todos.json`.
- AWS infrastructure and CI/CD automation defined in CloudFormation.

## Local Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Local Test

```bash
npm test
```

## Container Images

Frontend image:

```bash
docker build -f frontend/Dockerfile -t todo-frontend .
```

Backend image:

```bash
docker build -f backend/Dockerfile -t todo-backend .
```

## AWS CloudFormation

CloudFormation template: [infrastructure/cloudformation.yaml](/Users/yin/Desktop/lynn-assignment-Apr-code/infrastructure/cloudformation.yaml)

The template now provisions:

- VPC, public/private subnets, route tables, IGW, NAT Gateway
- ECR repositories for frontend and backend
- ECS cluster, task definitions, services, ALB, security groups
- CodeCommit repository
- CodePipeline pipeline
- CodeBuild test and deploy projects
- CloudWatch dashboard and alarms
- SNS topic and optional email subscription

### Important Parameters

- `AppName`: resource name prefix
- `CodeBranchName`: branch that triggers the pipeline
- `AlertEmail`: optional email for alarm notifications
- `FrontendDesiredCount` / `BackendDesiredCount`: bootstrap ECS counts for the first stack creation
- `FrontendRuntimeCount` / `BackendRuntimeCount`: counts applied by the pipeline deploy step
- `CpuAlarmThreshold`: ECS CPU alarm threshold
- `Http5xxAlarmThreshold`: ALB 5xx alarm threshold

### First Deployment

Deploy the stack first. Keep bootstrap desired counts at `0` so ECS services can be created before your first image build:

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name todo-app-stack \
  --template-file infrastructure/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AppName=todo-app \
    CodeBranchName=main \
    AlertEmail=your-email@example.com \
    FrontendDesiredCount=0 \
    BackendDesiredCount=0 \
    FrontendRuntimeCount=1 \
    BackendRuntimeCount=1
```

Check stack outputs:

```bash
aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name todo-app-stack \
  --query "Stacks[0].Outputs" \
  --output table
```

### Push Code To CodeCommit

Get the repository clone URL from stack outputs, then push your local repo:

```bash
CODECOMMIT_URL=$(aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name todo-app-stack \
  --query "Stacks[0].Outputs[?OutputKey=='CodeCommitCloneHttpUrl'].OutputValue" \
  --output text)
```

Add the remote and push:

```bash
git remote add aws "$CODECOMMIT_URL"
git push aws main
```

Each push to the configured branch triggers CodePipeline. The flow is:

1. `Source`: pull code from CodeCommit
2. `Test`: run `npm ci` and `npm test`
3. `Deploy`: build frontend/backend images, push to ECR, and force ECS redeployment

If tests fail, the pipeline stops in the Test stage. If tests succeed, it continues to deployment.

### Observe The Pipeline

```bash
aws codepipeline get-pipeline-state \
  --region us-east-1 \
  --name todo-app-pipeline
```

List CodeBuild runs:

```bash
aws codebuild list-builds-for-project \
  --region us-east-1 \
  --project-name todo-app-test

aws codebuild list-builds-for-project \
  --region us-east-1 \
  --project-name todo-app-deploy
```

### Monitoring

The stack creates:

- a CloudWatch dashboard
- CPU alarms for frontend and backend ECS services
- a backend target HTTP 5xx alarm
- an SNS topic for notifications

If you pass `AlertEmail`, AWS sends a subscription confirmation email. You must confirm it before alarm emails will be delivered.

To generate visible `HTTPCode_Target_5XX_Count` spikes, send requests to the backend-only test route after deployment:

```bash
ALB_URL="http://your-alb-dns-name"

for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code}\n" "${ALB_URL}/api/test/target-5xx?code=503&rate=0.6"
  sleep 2
done
```

This route returns `200` for some requests and `500`/`502`/`503`/`504` for others, so the target 5xx graph shows a spike instead of a flat line.

Requests such as `/34324/120/API/113` do not help here because the ALB listener only forwards lowercase `/api/*` to the backend. Other paths fall through to the frontend and return `200` with `index.html`.

### Cleanup

If you want to remove the stack after testing:

```bash
aws cloudformation delete-stack \
  --region us-east-1 \
  --stack-name todo-app-stack
```

## API

- `GET /api/todos` - list all todos
- `POST /api/todos` - create a todo
- `PUT /api/todos/:id` - update a todo
- `DELETE /api/todos/:id` - delete a todo
- `GET /api/test/target-5xx?code=503&rate=0.6` - generate synthetic backend 5xx responses for CloudWatch testing
