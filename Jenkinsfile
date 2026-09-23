// EcoVault Lite 的 Jenkins node24 流水线，负责依赖安装、质量校验、测试覆盖率、打包归档与主分支部署。
pipeline {
  agent any

  tools {
    nodejs 'node24'
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    CI = 'true'
  }

  stages {
    stage('安装依赖') {
      steps {
        sh 'npm ci'
      }
    }

    stage('静态检查') {
      steps {
        sh 'npm run lint'
        sh 'npm run format:check'
      }
    }

    stage('测试与覆盖率') {
      steps {
        sh 'mkdir -p reports'
        sh 'npx c8 --reporter=lcov --reporter=text --reporter=html node --test --test-reporter=junit --test-reporter-destination=reports/junit.xml --test-reporter=spec --test-reporter-destination=stdout'
      }
      post {
        always {
          junit testResults: 'reports/junit.xml', allowEmptyResults: true
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('打包归档') {
      steps {
        sh 'npm pack'
        archiveArtifacts artifacts: '*.tgz', fingerprint: true
      }
    }

    stage('部署（仅主分支）') {
      when {
        branch 'master'
      }
      steps {
        sh 'bash deploy/deploy.sh'
      }
    }
  }

  post {
    always {
      echo "流水线结束，当前结果：${currentBuild.currentResult}"
    }
    success {
      echo '流水线执行成功，产物已归档。'
    }
    failure {
      echo '流水线执行失败，请查看前序阶段日志。'
    }
  }
}
