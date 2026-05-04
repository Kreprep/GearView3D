# GearView 3D Thesis Development Plan

**Team:** Eugene (you), Bianca, John | **Timeline:** 2-3 months | **Coordination:** Discord/GitHub

---

## TL;DR - What You Need to Do

**Install first:**
- Node.js 20 LTS
- PostgreSQL (via Docker) or PostgreSQL installer
- Git + GitHub desktop
- VS Code
- DBeaver (database tool)
- Vite is not installed separately here; it comes with the frontend project setup through `npm create vite@latest`

**Tech Stack:**
- Frontend: React 18 + Vite + TailwindCSS + React Router + React Three Fiber
- Backend: Node.js + Express.js + Prisma ORM
- Database: PostgreSQL
- 3D Graphics: Three.js (via React Three Fiber)
- Deployment: Vercel (frontend) + Railway/Render (backend)

**Development Order:**
1. Week 1-2: Learn fundamentals + setup environment
2. Week 3-4: Build backend API + database schema
3. Week 5-6: Build frontend pages + authentication
4. Week 7-8: Integrate 3D model + polish
5. Week 9-10: Testing + deployment + evaluation

---

## Step-by-Step Setup & Learning Path

### **Phase 0: Environment Setup (Weekend)**

#### 1. **Install Required Software**
```
✓ Node.js 20 LTS (from nodejs.org)
✓ Git (from git-scm.com)
✓ VS Code (from code.visualstudio.com)
✓ PostgreSQL - ONE of these options:
  - PostgreSQL Installer (easiest for Windows)
  - Docker Desktop + PostgreSQL image (recommended)
  - Supabase cloud (free tier, no local setup)
✓ DBeaver Community (free database tool)
✓ GitHub account + git configured
```

#### 2. **Windows Setup for Docker (OPTIONAL but RECOMMENDED)**
If you choose Docker:
```bash
# Install Docker Desktop for Windows
# Then create a PostgreSQL container:
docker run --name thesis-postgres \
  -e POSTGRES_PASSWORD=thesis123 \
  -p 5432:5432 \
  -d postgres:15

# Verify it works:
docker ps
```

#### 3. **Create GitHub Repository**
- Create ONE repo: `gearview-3d`
- Initialize with: Node.gitignore, React template
- Set up main, develop, feature/* branch strategy
- Each person: clone and configure

#### 4. **Initial Project Structure**
```bash
gearview-3d/
├── frontend/              # React + Vite
├── backend/               # Node.js + Express
├── docs/                  # Thesis documentation
└── .gitignore
```

---

## Phase 1: Learning Fundamentals (Weeks 1-2)

### **What Everyone Needs to Learn**

**Developer A (Frontend Lead) - 8 hours learning:**
1. JavaScript ES6+ syntax (3 hrs)
   - Variables, functions, arrow functions
   - Async/await, promises
   - Array/object methods
2. React fundamentals (3 hrs)
   - Components, JSX, state, props
   - Hooks (useState, useEffect, useContext)
   - Event handling
3. Node.js/npm basics (1 hr)
4. Git & GitHub workflow (1 hr)

**Developer B (Backend Lead) - 8 hours learning:**
1. JavaScript ES6+ syntax (same as A)
2. Node.js & npm (2 hrs)
3. Express.js basics (2 hrs)
   - Routing, middleware
   - Request/response
4. SQL basics (2 hrs)
5. Git workflow

**Developer C (3D Lead) - 8 hours learning:**
1. JavaScript ES6+ syntax
2. React fundamentals (2 hrs)
3. Three.js fundamentals (3 hrs)
   - Scene, camera, renderer
   - Geometry, materials, meshes
   - Loading models
4. React Three Fiber basics (2 hrs)
5. Git workflow

### **Recommended Learning Resources**
- **JavaScript:** FreeCodeCamp YouTube - "Web Development" course
- **React:** Official React.dev tutorial (interactive)
- **Node.js:** Official Node.js documentation + simple tutorial
- **SQL:** W3Schools SQL Tutorial (free)
- **Three.js:** Three.js official docs + React Three Fiber examples
- **Express.js:** Express official guide
- **Total time per person:** 8-12 hours (do it in parallel, not sequential)

---

## Phase 2: Backend Foundation (Weeks 3-4)

### **Developer B (Backend) Primary Owner**

**Week 3: Database Schema & API Design**
1. Design PostgreSQL schema
   ```sql
   users (id, email, password_hash, role, created_at)
   courses (id, name, description, created_at)
   lessons (id, course_id, name, content, created_at)
   user_progress (id, user_id, lesson_id, completed, score)
   equipment_parts (id, lesson_id, name, description, image_url)
   ```

2. Create Express.js project
   ```bash
   mkdir backend && cd backend
   npm init -y
   npm install express cors dotenv prisma @prisma/client
   npm install --save-dev nodemon
   ```

3. Setup Prisma ORM
   ```bash
   npx prisma init
   # Configure .env with PostgreSQL connection string
   npx prisma migrate dev --name init
   npx prisma studio  # Visual database editor
   ```

4. Build skeleton API endpoints (GET/POST for each resource)

**Week 4: Authentication & CRUD Operations**
1. User registration/login with JWT tokens
2. Password hashing with bcrypt
3. Complete CRUD for:
   - Courses
   - Lessons
   - User progress tracking
4. Error handling middleware
5. Basic validation

**Backend Endpoints to Create (MVP):**
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
GET    /api/courses/:id/lessons
POST   /api/courses/:id/lessons
POST   /api/progress
GET    /api/progress/user/:userId
```

### **Support from A & C:**
- A: Help with API documentation format
- C: Suggest 3D data structure needs

---

## Phase 3: Frontend & Auth (Weeks 5-6)

### **Developer A (Frontend) Primary Owner**

**Week 5: Project Setup & Basic Pages**
1. Create Vite React project
   ```bash
   npm create vite@latest frontend -- --template react
   cd frontend
   npm install
   npm install react-router-dom zustand axios tailwindcss
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

2. Setup folder structure
   ```
   src/
   ├── components/    # Reusable components
   ├── pages/         # Page components
   ├── hooks/         # Custom hooks
   ├── store/         # Zustand state
   ├── utils/         # Helpers
   ├── api/           # API calls
   └── App.jsx
   ```

3. Create basic pages
   - Login page (form + validation)
   - Registration page
   - Dashboard/home page
   - Courses list page

4. Setup API communication layer
   ```javascript
   // api/client.js
   import axios from 'axios';
   
   const apiClient = axios.create({
     baseURL: 'http://localhost:5000/api'
   });
   
   export default apiClient;
   ```

**Week 6: State Management & Page Navigation**
1. Setup Zustand store for:
   - User authentication state
   - Course/lesson data
   - UI state

2. Create lesson detail page with:
   - Course info
   - Lesson content
   - Navigation between lessons
   - Progress tracking

3. Create admin page skeleton (to add courses/lessons)

4. Implement protected routes (require login)

### **Support from B & C:**
- B: Test API integration, provide endpoint documentation
- C: Provide data structure for 3D models

---

## Phase 4: 3D Integration (Weeks 7-8)

### **Developer C (3D) Primary Owner**

**Week 7: 3D Scene Setup**
1. Find/create 3D forklift model
   - Search: Sketchfab, TurboSquid (free models)
   - Export as .glb or .gltf format
   - If not found: Use simple 3D cylinder/box as placeholder

2. Create 3D viewer component with React Three Fiber
   ```bash
   npm install three @react-three/fiber @react-three/drei
   ```

3. Build interactive scene with:
   - Model loading from .glb file
   - Mouse controls (rotate, zoom)
   - Lighting setup
   - Camera positioning
   - Responsive sizing

4. Create exploded view (show parts separately)

**Week 8: Interactive Features & Integration**
1. Part identification/labeling system
   - Click parts to show labels
   - Highlight selected part
   - Display part information (from database)

2. Pre-operational checklist simulation
   - Interactive checklist overlaid on 3D model
   - Track completed items
   - Safety reminders

3. Integrate into lesson page
   - Embed 3D viewer in lesson content
   - Store which 3D model belongs to which lesson

### **Support from A & B:**
- A: Integrate 3D component into lesson page layout
- B: Create API endpoints for part data and progress

---

## Phase 5: Polish, Testing & Deployment (Weeks 9-10)

### **All Together**

**Error Handling & Validation:**
- Frontend: Form validation + user feedback
- Backend: Input validation, error responses
- Database: Constraints, cascades

**Testing (Basic):**
- Manual testing of each feature
- Test login/authentication flow
- Test API endpoints with Postman
- Test 3D model loading

**Deployment:**
1. Backend deployment to Railway/Render
2. Frontend deployment to Vercel
3. Connect to cloud PostgreSQL (Render/Supabase)
4. Test in production

**Thesis Documentation:**
- Architecture overview
- API documentation
- User guide
- Technology choices

---

## Team Role Assignment & Monthly Rotation

### **MONTH 1: Specialization**
- **A:** Frontend Lead (70% React, 20% learn backend, 10% DevOps)
- **B:** Backend Lead (70% Express/DB, 20% learn frontend, 10% DevOps)
- **C:** 3D Graphics Lead (70% Three.js, 20% learn full stack, 10% DevOps)

### **MONTH 2: Cross-Functional**
- **A:** 3D Integration + responsive design (frontend-heavy)
- **B:** API optimization + data migration (backend-heavy)
- **C:** Performance optimization + animations (balanced)

### **MONTH 3: Integration & Polish**
- All rotate through each area
- Focus: Deployment, documentation, testing
- One person per week focuses on each major area

---

## Weekly Sync Meetings (on Discord)

**Every Monday 2hrs (use Discord voice + screen share):**
1. Demo what each person built
2. Discuss blockers
3. Adjust tasks if needed
4. Code review before merging

**Async communication:** Discord #general and #dev-help channels

---

## Critical Success Factors

### **DO's:**
✓ Start with backend FIRST (frontend can't work without API)
✓ Use Prisma Studio to visualize database changes
✓ Test API with Postman before connecting to frontend
✓ Commit to GitHub every day (small commits)
✓ Document as you go (comments, README updates)
✓ Make one 3D model work perfectly before adding more

### **DON'Ts:**
✗ Don't build perfect UI before backend is ready
✗ Don't create multiple 3D models without testing first
✗ Don't wait until the end to deploy (deploy early, often)
✗ Don't skip authentication implementation
✗ Don't hardcode values - use environment variables (.env)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Team member gets stuck** | Daily async updates, help channels, rotate work |
| **3D model file issues** | Start with simple box/cylinder, replace later |
| **Database crashes** | Use managed database (Supabase/Railway), regular backups |
| **API integration bugs** | Test API separately with Postman first |
| **Deployment fails** | Deploy dummy app week 8, practice before production |
| **Running out of time** | MVP scope is clear, cut nice-to-haves not core features |

---

## MVP vs Nice-to-Have Features

### **MUST HAVE (MVP):**
- User login/registration
- Course and lesson pages
- ONE 3D forklift model
- Basic 3D interaction (rotate, zoom)
- Part identification labels
- Progress tracking
- Deployment to production

### **NICE-TO-HAVE (If time permits):**
- Admin panel for course creation
- Multiple equipment models
- Video lessons
- Quiz functionality
- Advanced 3D animations
- User analytics dashboard

---

## Installation Checklist for Each Developer

After reading this plan, each developer should:

- [ ] Install Node.js 20 LTS
- [ ] Install PostgreSQL (Docker or installer)
- [ ] Install Git and configure
- [ ] Install VS Code + extensions (ESLint, Prettier, Thunder Client)
- [ ] Create GitHub account
- [ ] Clone the repository
- [ ] Create feature branch: `git checkout -b onboarding/setup`
- [ ] Complete learning resources for their role (8 hrs)
- [ ] Post in Discord: "Setup complete, ready to start"

---

## Next Actions (This Week)

1. **Eugene (You) - Decision:**
   - Confirm database approach (Docker, PostgreSQL, or Supabase)
   - Assign roles (A, B, C) to yourself and team
   
2. **All Three:**
   - Install required software
   - Join GitHub repo
   - Schedule first sync meeting
   
3. **Developer B (Backend Lead):**
   - Start learning Express.js
   - Design initial database schema
   - Report back: schema draft by end of week

---

## Resources & Documentation Links

- Node.js: https://nodejs.org/
- React: https://react.dev
- Express: https://expressjs.com
- PostgreSQL: https://www.postgresql.org
- Prisma: https://www.prisma.io
- Three.js: https://threejs.org
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/
- Vite: https://vitejs.dev
- TailwindCSS: https://tailwindcss.com
- Railway (Backend Hosting): https://railway.app
- Vercel (Frontend Hosting): https://vercel.com

---

**Last Updated:** May 4, 2026
**Status:** Planning phase complete, ready for implementation
