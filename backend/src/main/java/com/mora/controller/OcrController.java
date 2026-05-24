package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.service.OcrService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Tag(name = "OCR", description = "이미지 문자 인식(OCR) API")
@RestController
@RequestMapping("/api")
public class OcrController {

    private final OcrService ocrService;

    public OcrController(OcrService ocrService) {
        this.ocrService = ocrService;
    }

    /*
     * 이미지를 OCR 서버에 보내 문자 인식을 수행한다. (명함, 티켓, 포스터 등)
     * 비회원도 OCR 스캔 가능. (스캔만. 저장, 조회와 같은 기능은 로그인 필수)
     */
    @PostMapping("/scan")
    public ResponseEntity<ApiResponse<Map<String, Object>>> scan(@RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> result = ocrService.scan(file);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}
